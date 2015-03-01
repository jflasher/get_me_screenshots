'use strict';

require('newrelic');
var webshot = require('webshot');
var fs = require('fs');
var mailer = require('./mailer');
var settings = require('./settings.json');
var uuid = require('node-uuid');
var moment = require('moment');
var http = require('http');
moment().format();

var port = process.env.PORT || 5000;

// try to load smtp settings from file
var smtpSettings = {};
try {
  smtpSettings = require('./smtp.json');
} catch (e) {
  console.log('No smtp settings file found but that may be ok.');
}

////
// Possible changes here
////

// The temp directoy to write to
var tmpDir = './tmp/';

////
// Below here be dragons
////

var sites = settings.sites;

var delayToFirstScreenshot = function (hour, minute) {
  var now = moment.utc();
  var start = moment.utc([now.year(), now.month(), now.date(), hour, minute]);
  var diff = start.diff(now, 'minutes');
  if (diff < 0) {
    diff = (24 * 60) + diff;
  }
  // Output diff in ms
  return diff * 60 * 1000;
};

// Setup the mailer
mailer.setup(smtpSettings);

// Get the screenshot and send via email
var getScreenshot = function (site) {
  console.log('[' + moment.utc().format() + '] Loading page for ' + site.url);
  var filePath = tmpDir + uuid.v4() + '.png';
  var options = {
    renderDelay: 10000,
    phantomConfig: {
      'ignore-ssl-errors': true
    },
    errorIfStatusIsNot200: true
  };
  webshot(site.url, options, function(err, renderStream) {
    if (err) {
      return console.log(err);
    }

    var file = fs.createWriteStream(filePath, {encoding: 'binary'});

    renderStream.on('data', function (data) {
      file.write(data.toString('binary'), 'binary');
    });

    renderStream.on('end', function () {
      sendEmail(site.description, filePath);
    });

  });
};

sites.forEach(function(site) {
  // Figure out the delay until the first screenshot should happen and then
  // set a 1 day interval
  var timeToStart = delayToFirstScreenshot(site.UTCHour, site.UTCMinute);
  console.log('Will take a screenshot of ' + site.url + ' in ' +
    timeToStart/1000 + ' seconds.');
  setTimeout(function () {
    getScreenshot(site);
    setInterval(function () {
      getScreenshot(site);
    }, 24 * 60 * 60 * 1000);
  }, timeToStart);
});

// Send out an email
var sendEmail = function (description, image) {
  var mailOptions = {
    from: process.env.MAILER_FROM || smtpSettings.from, // sender address
    to: process.env.MAILER_TO || smtpSettings.to, // list of receivers
    subject: '[Give Me Screenshots] ' + moment.utc().format() + ' - ' + description,
    attachments: {
      filePath: image
    }
  };

  // send mail with defined transport object
  mailer.send(mailOptions, function (error, response) {
    if (error){
        console.log(error);
    } else {
        console.log('Message sent: ' + response.message);
    }

    // After mail is sent, clean up tmp directory
    console.log('Cleaning up tmp directory');
    if (fs.existsSync(image)) {
      fs.unlinkSync(image);
    } else {
      console.log('Could not find image to delete, something surely went wrong');
    }
  });
};

// A tiny web server to keep this thing alive
http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('nothing to see here\n');
}).listen(port);
