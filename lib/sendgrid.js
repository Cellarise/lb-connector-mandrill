"use strict";
var assert = require('assert');
var R = require('ramda');
var Q = require('q');
var Mailer = function Mailer() {};
var sendGridLib = require('sendgrid');
/* eslint-disable no-unused-vars */
var sendgridInstance = {};
var sendgridFilters = {};
/* eslint-enable no-unused-vars */

var SendgridConnector = function SendgridConnector(settings) {
  assert(typeof settings === 'object', 'cannot init connector without settings');

  if (settings.api_key && !settings.api_user){
    this.sendgrid = sendGridLib.SendGrid(settings.api_key, settings.options);
  } else if (settings.api_user && settings.api_password) {
    this.sendgrid = sendGridLib.SendGrid(settings.api_user, settings.api_password, settings.options);
  } else {
    // fallback to legacy
    this.sendgrid = sendGridLib.SendGrid(settings.api_user, settings.api_key, settings.options);
  }

  this.filters = settings.filters;
  sendgridFilters = this.filters;
  sendgridInstance = this.sendgrid;
};

SendgridConnector.initialize = function (dataSource, callback) {
  dataSource.connector = new SendgridConnector(dataSource.settings);
  callback();
};

SendgridConnector.prototype.DataAccessObject = Mailer;

/**
 * Send transactional email with options
 * Full list of options are available here: https://www.npmjs.com/package/sendgrid#available-params
 *
 * @param {Object} options
 * {
 *   from: { name: "John", email: "john@cellarise.com" },
 *   to: "mail@cellarise.com",
 *   subject: "Test mail",
 *   text: "Plain text message",
 *   html: "<b>Html messages</b> here"
 * }
 *
 * @param {Function} cb callback
 * @returns {Function} deferred promise
 */
Mailer.send = function (options, cb) {
  var dataSource = this.dataSource,
    //settings = dataSource && dataSource.settings,
    connector = dataSource.connector,
    deferred = Q.defer(),
    sendgridEmail,
    sendgridMessage = {};
  var fn = function (err, result) {
    if (err) {
      deferred.reject(err);
    } else {
      deferred.resolve(result);
    }
    return cb && cb(err, result);
  };

  if (options.__data) {
    options = R.clone(options.__data);
  } else {
    options = R.clone(options);
  }

  assert(connector, 'Cannot send mail without a connector!');

  if (connector.sendgrid) {
    //email from param
    if (R.is(String, options.from)) {
      sendgridMessage.from = options.from;
    } else if (R.is(Object, options.from)) {
      sendgridMessage.fromname = options.from.name;
      if (options.from.hasOwnProperty('address')) {
        sendgridMessage.from = options.from.address;
      } else if (options.from.hasOwnProperty('email')) {
        sendgridMessage.from = options.from.email;
      }
    } else {
      if (options.from_name) {
        sendgridMessage.fromname = options.from_name || '';
      }
      if (options.from_email) {
        sendgridMessage.from = options.from_email || '';
      }
    }
    delete options.from;

    //email to param
    if (R.is(String, options.to)) {
      sendgridMessage.to = options.to.split(',');
    } else if (R.is(Object, options.to)) {
      sendgridMessage.to = [options.to];
    } else {
      sendgridMessage.to = options.to;
    }
    delete options.to;

    sendgridMessage.text = options.text || '';
    sendgridMessage.html = options.html || '';
    sendgridMessage = R.merge(options, sendgridMessage);

    sendgridEmail = new connector.sendgrid.Email(sendgridMessage);
    if (options.files) {
      R.forEach(function eachFile(fileConfig){
        sendgridEmail.addFile(fileConfig);
      }, options.files);
    }
    if (sendgridFilters) {
      sendgridEmail.setFilters(sendgridFilters);
    }

    connector.sendgrid.send(sendgridEmail, fn);
  } else {
    process.nextTick(function () {
      fn(null, options);
    });
  }
  return deferred.promise;
};

/**
 * Send an email instance using instance
 */

Mailer.prototype.send = function (fn) {
  return this.constructor.send(this, fn);
};

/**
 * Export the connector class
 */
module.exports = SendgridConnector;
