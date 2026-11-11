WEBS = {};

WEBS.GetNativeRelay = function()
{
	try
	{
		if (window.PortfoliOSNativeRelay)
			return window.PortfoliOSNativeRelay;
		if (window.parent && window.parent !== window && window.parent.PortfoliOSNativeRelay)
			return window.parent.PortfoliOSNativeRelay;
		if (window.top && window.top !== window && window.top.PortfoliOSNativeRelay)
			return window.top.PortfoliOSNativeRelay;
	}
	catch (e) {}
	return null;
};

WEBS.Init = function()
{
	if ((window.WebSocket == null) && (WEBS.GetNativeRelay() == null))
		return;
	WEBS.available = true;
	return true;
};

WEBS.Connect = function(host)
{
	if (!host || host.length <= 3)
		return;
	var relay = WEBS.GetNativeRelay();
	var isUdpRelay = (host.substring(0, 6) === 'udp://') || (relay != null && document.location.protocol === 'https:' && host.substring(0, 5) === 'ws://');
	if (isUdpRelay && relay != null && typeof relay.createUdpSocket === 'function')
	{
		var rawTarget = host.replace(/^(udp|ws|wss):\/\//i, '').split('/')[0];
		var parts = rawTarget.split(':');
		var targetHost = parts[0] || '127.0.0.1';
		var targetPort = parseInt(parts[1] || '26000', 10) || 26000;
		var sock = NET.NewQSocket();
		sock.disconnected = true;
		sock.receiveMessage = [];
		sock.address = 'udp://' + targetHost + ':' + targetPort;
		var driver = {
			readyState: 0,
			data_socket: sock,
			udpSocket: null,
			send: function(buf)
			{
				if (this.udpSocket)
					this.udpSocket.send(new Uint8Array(buf), targetPort, targetHost);
			},
			close: function()
			{
				this.readyState = 3;
				if (this.udpSocket)
					this.udpSocket.close();
			}
		};
		sock.driverdata = driver;
		relay.createUdpSocket(0, '0.0.0.0').then(function(udpSock)
		{
			driver.udpSocket = udpSock;
			driver.readyState = 1;
			udpSock.on('message', function(bytes)
			{
				if (bytes && bytes.byteLength <= 8000)
					sock.receiveMessage.push(new Uint8Array(bytes));
			});
			udpSock.on('error', function()
			{
				NET.Close(sock);
			});
		}).catch(function()
		{
			driver.readyState = 3;
			NET.Close(sock);
		});
		NET.newsocket = sock;
		return 0;
	}
	if (host.length <= 5)
		return;
	if (host.charCodeAt(5) === 47 && host.substring(0, 6) !== 'wss://')
		return;
	var isWss = host.substring(0, 6) === 'wss://';
	var isWs = host.substring(0, 5) === 'ws://';
	if (!isWs && !isWss)
		return;
	var scheme = isWss ? 'wss://' : (document.location.protocol === 'https:' ? 'wss://' : 'ws://');
	host = scheme + host.split('/')[2];
	var sock = NET.NewQSocket();
	sock.disconnected = true;
	sock.receiveMessage = [];
	sock.address = host;
	try
	{
		sock.driverdata = new WebSocket(host, 'quake');
	}
	catch (e)
	{
		return;
	}
	sock.driverdata.data_socket = sock;
	sock.driverdata.binaryType = 'arraybuffer';
	sock.driverdata.onerror = WEBS.OnError;
	sock.driverdata.onmessage = WEBS.OnMessage;
	NET.newsocket = sock;
	return 0;
};

WEBS.CheckNewConnections = function()
{
};

WEBS.GetMessage = function(sock)
{
	if (sock.driverdata == null)
		return -1;
	if (sock.driverdata.readyState !== 1)
		return -1;
	if (sock.receiveMessage.length === 0)
		return 0;
	var message = sock.receiveMessage.shift();
	NET.message.cursize = message.length - 1;
	(new Uint8Array(NET.message.data)).set(message.subarray(1));
	return message[0];
};

WEBS.SendMessage = function(sock, data)
{
	if (sock.driverdata == null)
		return -1;
	if (sock.driverdata.readyState !== 1)
		return -1;
	var buf = new ArrayBuffer(data.cursize + 1), dest = new Uint8Array(buf);
	dest[0] = 1;
	dest.set(new Uint8Array(data.data, 0, data.cursize), 1);
	sock.driverdata.send(buf);
	return 1;
};

WEBS.SendUnreliableMessage = function(sock, data)
{
	if (sock.driverdata == null)
		return -1;
	if (sock.driverdata.readyState !== 1)
		return -1;
	var buf = new ArrayBuffer(data.cursize + 1), dest = new Uint8Array(buf);
	dest[0] = 2;
	dest.set(new Uint8Array(data.data, 0, data.cursize), 1);
	sock.driverdata.send(buf);
	return 1;
};

WEBS.CanSendMessage = function(sock)
{
	if (sock.driverdata == null)
		return;
	if (sock.driverdata.readyState === 1)
		return true;
};

WEBS.Close = function(sock)
{
	if (sock.driverdata != null)
		sock.driverdata.close(1000);
};

WEBS.CheckForResend = function()
{
	if (NET.newsocket.driverdata.readyState === 1)
		return 1;
	if (NET.newsocket.driverdata.readyState !== 0)
		return -1;
};

WEBS.OnError = function()
{
	NET.Close(this.data_socket);
};

WEBS.OnMessage = function(message)
{
	var data = message.data;
	if (typeof(data) === 'string')
		return;
	if (data.byteLength > 8000)
		return;
	this.data_socket.receiveMessage.push(new Uint8Array(data));
};