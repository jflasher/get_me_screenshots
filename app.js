'use strict';

var webshot = require('webshot');
var async = require('async');
var zip = new require('node-zip')();
var fs = require('fs');
var smtpSettings = require('./smtp.json');
var mailer = require('./mailer');
var dateFormat = require('dateformat');
var settings = require('./settings.json');

////
// Possible changes here
////

// The temp directoy to write to
var tmpDir = './tmp/';

////
// Below here be dragons
////

var sites = settings.sites;
var delay = settings.delay * 1000;  // Delay in ms

// Setup the mailer
mailer.setup(smtpSettings);

// Build up the screenshot tasks
var asyncTasks = [];
sites.forEach(function(site) {
  asyncTasks.push(function(callback) {
    webshot(site, tmpDir + site + '.png', function(err) {
      callback(null);
    });
  });
});

var doAllTheThings = function() {
  async.parallel(asyncTasks, function(err, results) {
    if (err) {
      console.log(err);
      return;
    }
    
    // Screenshots done
    console.log('Generated all screenshots');

    // Zip up results
    console.log('Zipping up all the images');
    makeZip();

    // Email file
    console.log('Sending out an email');
    sendEmail();
  });
};

doAllTheThings();
setInterval(function () {
  doAllTheThings();
}, delay);

// Zip up files in the temp directory
var makeZip = function () {
  var files = fs.readdirSync(tmpDir);
  files.forEach(function(file) {
    var fileName = tmpDir + file;
    var imgData = fs.readFileSync(fileName);
    zip.file(fileName, imgData, {base64: true});
  });
  var data = zip.generate({base64:false,compression:'DEFLATE'});
  fs.writeFileSync(tmpDir + 'images.zip', data, 'binary');
};

// Send out an email
var sendEmail = function () {
  var mailOptions = {
    from: smtpSettings.from, // sender address
    to: smtpSettings.to, // list of receivers
    subject: 'New Screenshot Bundle',
    attachments: {
      filename: dateFormat(new Date(), 'isoDateTime') + '.zip',
      filePath: tmpDir + 'images.zip'
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
    cleanTmpDirectory();
  });
};

// Clean up the temp directory
var cleanTmpDirectory = function () {
  var files = fs.readdirSync(tmpDir);
  files.forEach(function(file) {
    var fileName = tmpDir + file;
    fs.unlinkSync(fileName);    
  }); 
};