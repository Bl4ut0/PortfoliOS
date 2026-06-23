/**
 * PortfoliOS: Event Bus
 * Lightweight pub/sub messaging system for decoupling core modules.
 */
window.EventBus = {
    listeners: {},

    /**
     * Subscribe to an event
     * @param {string} event - The event name
     * @param {function} callback - The callback function
     * @returns {function} Unsubscribe function
     */
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
        return () => this.off(event, callback);
    },

    /**
     * Unsubscribe from an event
     * @param {string} event - The event name
     * @param {function} callback - The callback function to remove
     */
    off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    },

    /**
     * Publish an event
     * @param {string} event - The event name
     * @param {*} data - Data to pass to listeners
     */
    emit(event, data) {
        if (!this.listeners[event]) return;
        this.listeners[event].forEach(callback => {
            try {
                callback(data);
            } catch (err) {
                console.error(`Error in EventBus listener for "${event}":`, err);
            }
        });
    }
};
