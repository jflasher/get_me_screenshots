get_me_screenshots
==================

A small node.js app to grab screenshots at certain times of day and email them 
to a user. The app will keep going and sending screenshots every day (hopefully).

For this to work, you will need to rename smtp_sample.json to smtp.json and 
include appropriate SMTP info.

To run
    
    npm install
    mkdir tmp
    cp smtp_sample.json smtp.json
    vim smtp.json
    node app.js