var castvs2Cli = require('castv2-client');
var Client = castvs2Cli.Client;
var DefaultMediaReceiver = castvs2Cli.DefaultMediaReceiver;
var mdns = require('mdns');
var mutate = require('mutate.js');
var extend = require('xtend');
var promise = require('when').promise;

var defaults = {
  autoplay: true
};

// find chromecast devices in the network and
// either return the first found or the one
// which matches deviceName.
var findDevice = function(deviceName, ttl) {
  return promise(function(resolve, reject) {
    var scanner = mdns.createBrowser(mdns.tcp('googlecast'));
    if (!ttl) ttl = 10000; // default to 10 seconds
    var timer = setTimeout(function() {
      scanner.stop();
      reject('device not found');
    }, ttl);
    scanner.on('serviceUp', function(service) {
      if (deviceName && deviceName !== service.name) return;
      resolve(service);
      scanner.stop();
      clearTimeout(timer);
    });
    scanner.start();
  });
};

// establish a connection to a chromecast device
var connectClient = function(service) {
  return promise(function(resolve, reject) {
    var client = new Client();
    client.connect(service.addresses[0], function() {
      // TODO: handle errorcase here
      resolve(client);
    });
    client.on('error', function() {
      client.close();
    });
  });
};

// launch the DefaultMediaReceiver on
// the chromecast device
var launchClient = function(client) {
  return promise(function(resolve, reject) {
    client.launch(DefaultMediaReceiver, function(err, player) {
      if (err) return reject(err);
      resolve(player);
    });
  });
};

// load a media file
var loadMedia = function(player, opts) {
  return promise(function(resolve, reject) {
    var media = {
      contentId: opts.path,
      contentType: opts.type,
      streamType: opts.streamType || 'BUFFERED',
      metadata: opts.metadata
    };
    player.load(media, { autoplay: opts.autoplay }, function(err) {
      if (err) return reject(err);
      resolve(player);
    });
  });
};

// boot the player
var player = mutate(function(opts) {
  var options = extend(defaults, opts);

  if (opts._opts) {
    options = extend(options, opts._opts);
    delete opts._opts;
  }

  var proc = findDevice(options.device, options.ttl)
    .then(function(service) {
      return connectClient(service);
    })
    .then(function(client) {
      return launchClient(client);
    })
    .then(function(player) {
      return loadMedia(player, options)
    });

  if (!opts.cb) return proc;

  // use the callback provided
  return proc.then(function(player) {
      opts.cb(null, player);
    })
    .catch(function(err) {
      opts.cb(err);
    });
});

// create a nice API
player
  .method(['string'], ['path'])
  .method(['string', 'function'], ['path', 'cb'])
  .method(['string', 'object'], ['path', '_opts'])
  .method(['string', 'object', 'function'], ['path', '_opts', 'cb'])
  .method(['string', 'string'], ['path', 'type'])
  .method(['string', 'string', 'function'], ['path', 'type', 'cb'])
  .method(['string', 'string', 'object'], ['path', 'type', '_opts'])
  .method(['string', 'string', 'object', 'function'], ['path', 'type', '_opts', 'cb']);

module.exports = player.close();
