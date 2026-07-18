(function() {
    let activeController = null;
    let keyboardActive = false;
    let expression = "";
    let displayValue = "0";
    let historyValue = "";
    let justEvaluated = false;

    function tokenize(source) {
        const tokens = [];
        let index = 0;
        while (index < source.length) {
            const remaining = source.slice(index);
            const whitespace = remaining.match(/^\s+/);
            if (whitespace) {
                index += whitespace[0].length;
                continue;
            }
            const number = remaining.match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
            if (number) {
                tokens.push({ type: "number", value: Number(number[0]) });
                index += number[0].length;
                continue;
            }
            const character = source[index];
            if ("+-*/()%".includes(character)) {
                tokens.push({ type: character, value: character });
                index += 1;
                continue;
            }
            throw new Error("Unsupported character");
        }
        tokens.push({ type: "eof" });
        return tokens;
    }

    function evaluateExpression(source) {
        const tokens = tokenize(source);
        let position = 0;
        const current = () => tokens[position];
        const consume = (type) => {
            if (current().type !== type) throw new Error("Incomplete expression");
            return tokens[position++];
        };

        const parsePrimary = () => {
            if (current().type === "+") {
                consume("+");
                return parsePrimary();
            }
            if (current().type === "-") {
                consume("-");
                return -parsePrimary();
            }

            let value;
            if (current().type === "number") {
                value = consume("number").value;
            } else if (current().type === "(") {
                consume("(");
                value = parseExpression();
                consume(")");
            } else {
                throw new Error("Number expected");
            }

            while (current().type === "%") {
                consume("%");
                value /= 100;
            }
            return value;
        };

        const parseTerm = () => {
            let value = parsePrimary();
            while (current().type === "*" || current().type === "/") {
                const operator = current().type;
                consume(operator);
                const right = parsePrimary();
                if (operator === "/" && right === 0) throw new Error("Cannot divide by zero");
                value = operator === "*" ? value * right : value / right;
            }
            return value;
        };

        const parseExpression = () => {
            let value = parseTerm();
            while (current().type === "+" || current().type === "-") {
                const operator = current().type;
                consume(operator);
                const right = parseTerm();
                value = operator === "+" ? value + right : value - right;
            }
            return value;
        };

        const result = parseExpression();
        consume("eof");
        if (!Number.isFinite(result)) throw new Error("Result is outside the supported range");
        return Math.abs(result) < 1e-12 ? 0 : Number(result.toPrecision(12));
    }

    function formatDisplay(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return String(value);
        return new Intl.NumberFormat("en-US", {
            maximumSignificantDigits: 12,
            useGrouping: true
        }).format(number);
    }

    function updateDisplay(root) {
        const expressionOutput = root?.querySelector("[data-calc-expression]");
        const resultOutput = root?.querySelector("[data-calc-result]");
        if (expressionOutput) expressionOutput.textContent = historyValue || expression || "Ready";
        if (resultOutput) resultOutput.textContent = formatDisplay(displayValue);
    }

    function clearCalculator(root) {
        expression = "";
        displayValue = "0";
        historyValue = "";
        justEvaluated = false;
        updateDisplay(root);
    }

    function preview(root) {
        if (!expression) {
            displayValue = "0";
            updateDisplay(root);
            return;
        }
        try {
            displayValue = String(evaluateExpression(expression));
        } catch (error) {
            displayValue = expression;
        }
        updateDisplay(root);
    }

    function appendDigit(root, digit) {
        if (justEvaluated) {
            expression = "";
            historyValue = "";
            justEvaluated = false;
        }
        if (expression.length >= 64) return;
        expression += digit;
        preview(root);
    }

    function appendDecimal(root) {
        if (justEvaluated) {
            expression = "";
            historyValue = "";
            justEvaluated = false;
        }
        const currentNumber = expression.split(/[+\-*/()%]/).pop() || "";
        if (currentNumber.includes(".")) return;
        expression += currentNumber ? "." : "0.";
        preview(root);
    }

    function appendOperator(root, operator) {
        if (!expression) {
            if (operator === "-") expression = "-";
            else if (justEvaluated || displayValue !== "0") expression = String(displayValue);
            else return;
        }
        justEvaluated = false;
        historyValue = "";
        if (/[+\-*/]$/.test(expression)) expression = expression.slice(0, -1) + operator;
        else expression += operator;
        updateDisplay(root);
    }

    function appendParenthesis(root, parenthesis) {
        if (expression.length >= 64) return;
        if (justEvaluated) {
            expression = "";
            historyValue = "";
            justEvaluated = false;
        }
        expression += parenthesis;
        preview(root);
    }

    function appendPercent(root) {
        if (!expression || !/[\d)]$/.test(expression)) return;
        expression += "%";
        preview(root);
    }

    function toggleSign(root) {
        if (!expression) {
            expression = displayValue === "0" ? "-" : String(-Number(displayValue));
        } else if (/^-\(.+\)$/.test(expression)) {
            expression = expression.slice(2, -1);
        } else {
            expression = `-(${expression})`;
        }
        justEvaluated = false;
        historyValue = "";
        preview(root);
    }

    function calculate(root) {
        if (!expression) return;
        try {
            const result = evaluateExpression(expression);
            historyValue = `${expression.replace(/\*/g, "×").replace(/\//g, "÷")} =`;
            expression = String(result);
            displayValue = String(result);
            justEvaluated = true;
        } catch (error) {
            historyValue = error.message || "Invalid expression";
            displayValue = "Error";
            justEvaluated = true;
        }
        updateDisplay(root);
    }

    function handleCommand(root, command) {
        if (/^\d$/.test(command)) {
            appendDigit(root, command);
            return;
        }
        if (["+", "-", "*", "/"].includes(command)) {
            appendOperator(root, command);
            return;
        }
        if (command === ".") appendDecimal(root);
        else if (command === "%") appendPercent(root);
        else if (command === "(") appendParenthesis(root, "(");
        else if (command === ")") appendParenthesis(root, ")");
        else if (command === "sign") toggleSign(root);
        else if (command === "equals") calculate(root);
        else if (command === "clear") clearCalculator(root);
        else if (command === "backspace") {
            expression = expression.slice(0, -1);
            historyValue = "";
            justEvaluated = false;
            preview(root);
        }
    }

    function bind(root) {
        activeController?.abort();
        activeController = new AbortController();
        const { signal } = activeController;
        keyboardActive = true;

        root.addEventListener("click", async (event) => {
            const key = event.target.closest("[data-calc]");
            if (key) {
                handleCommand(root, key.dataset.calc);
                return;
            }
            if (event.target.closest("[data-calc-copy]")) {
                try {
                    if (typeof navigator.clipboard?.writeText !== "function") throw new Error("Clipboard unavailable");
                    await navigator.clipboard.writeText(String(displayValue));
                    historyValue = "Copied to clipboard";
                } catch (error) {
                    historyValue = "Clipboard unavailable";
                }
                updateDisplay(root);
            }
        }, { signal });

        document.addEventListener("keydown", (event) => {
            if (!keyboardActive || !root.isConnected || event.ctrlKey || event.metaKey || event.altKey) return;
            if (event.target.closest?.("input, textarea, select, [contenteditable='true']")) return;

            let command = null;
            if (/^[0-9.+\-*/%()]$/.test(event.key)) command = event.key;
            else if (event.key === "Enter" || event.key === "=") command = "equals";
            else if (event.key === "Backspace" || event.key === "Delete") command = "backspace";
            else if (event.key === "Escape") command = "clear";
            if (!command) return;
            event.preventDefault();
            handleCommand(root, command);
        }, { signal });

        updateDisplay(root);
    }

    function serializeState() {
        return {
            version: 1,
            expression,
            displayValue,
            historyValue,
            justEvaluated
        };
    }

    function restoreState(root, context = {}) {
        if (context.signal?.aborted) return;
        const saved = context.state;
        if (!saved || typeof saved !== "object" || saved.version !== 1) return;

        const savedExpression = typeof saved.expression === "string" ? saved.expression.slice(0, 64) : "";
        expression = /^[0-9eE+\-*/().%\s]*$/.test(savedExpression) ? savedExpression : "";
        displayValue = typeof saved.displayValue === "string" ? saved.displayValue.slice(0, 128) : "0";
        historyValue = typeof saved.historyValue === "string" ? saved.historyValue.slice(0, 192) : "";
        justEvaluated = saved.justEvaluated === true;
        updateDisplay(root);
    }

    window.mobileAppRegistry.calculator = {
        title: "Calculator",
        icon: "fa-solid fa-calculator",
        viewClass: "mobile-calculator-app",
        render: () => `
            <section class="mobile-calculator-shell" aria-label="Calculator">
                <header class="mobile-calculator-display">
                    <div class="mobile-calculator-display-actions">
                        <span>Calculator</span>
                        <button type="button" data-calc-copy title="Copy result" aria-label="Copy result"><i class="fa-regular fa-copy"></i></button>
                    </div>
                    <small data-calc-expression>Ready</small>
                    <output data-calc-result aria-live="polite">0</output>
                </header>
                <div class="mobile-calculator-keys">
                    <button type="button" class="is-utility" data-calc="clear">AC</button>
                    <button type="button" class="is-utility" data-calc="sign">±</button>
                    <button type="button" class="is-utility" data-calc="%">%</button>
                    <button type="button" class="is-operator" data-calc="/">÷</button>

                    <button type="button" data-calc="7">7</button>
                    <button type="button" data-calc="8">8</button>
                    <button type="button" data-calc="9">9</button>
                    <button type="button" class="is-operator" data-calc="*">×</button>

                    <button type="button" data-calc="4">4</button>
                    <button type="button" data-calc="5">5</button>
                    <button type="button" data-calc="6">6</button>
                    <button type="button" class="is-operator" data-calc="-">−</button>

                    <button type="button" data-calc="1">1</button>
                    <button type="button" data-calc="2">2</button>
                    <button type="button" data-calc="3">3</button>
                    <button type="button" class="is-operator" data-calc="+">+</button>

                    <button type="button" class="is-wide" data-calc="0">0</button>
                    <button type="button" data-calc=".">.</button>
                    <button type="button" class="is-equals" data-calc="equals">=</button>
                </div>
                <button type="button" class="mobile-calculator-backspace" data-calc="backspace"><i class="fa-solid fa-delete-left"></i><span>Delete last digit</span></button>
            </section>
        `,
        onOpen: bind,
        onPause: () => { keyboardActive = false; },
        onResume: (root) => {
            keyboardActive = true;
            updateDisplay(root);
        },
        serializeState,
        restoreState,
        onClose: () => {
            keyboardActive = false;
            activeController?.abort();
            activeController = null;
        }
    };
})();
