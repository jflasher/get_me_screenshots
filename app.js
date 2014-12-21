'use strict';

var webshot = require('webshot');
var async = require('async');
var fs = require('fs');
var smtpSettings = require('./smtp.json');
var mailer = require('./mailer');
var settings = require('./settings.json');
var uuid = require('node-uuid');
var moment = require('moment');
moment().format();

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
    })
    
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
    from: smtpSettings.from, // sender address
    to: smtpSettings.to, // list of receivers
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
