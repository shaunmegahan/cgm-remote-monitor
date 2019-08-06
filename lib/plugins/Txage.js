'use strict';

var _ = require('lodash');
var moment = require('moment');
var levels = require('../levels');

function init(ctx) {
  var translate = ctx.language.translate;

  var txage = {
    name: 'txage'
    , label: 'Transmitter Age'
    , pluginType: 'pill-minor'
  };

  txage.getPrefs = function getPrefs (sbx) {
    // TXAGE_INFO = 44 TXAGE_WARN=48 TXAGE_URGENT=70
    return {
      info: sbx.extendedSettings.info || 44
      , warn: sbx.extendedSettings.warn || 48
      , urgent: sbx.extendedSettings.urgent || 72
      , display: sbx.extendedSettings.display ? sbx.extendedSettings.display : 'hours'
      , enableAlerts: sbx.extendedSettings.enableAlerts || false
    };
  };

  txage.setProperties = function setProperties (sbx) {
    sbx.offerProperty('txage', function setProp ( ) {
      return txage.findLatestTimeChange(sbx);
    });
  };

  txage.checkNotifications = function checkNotifications (sbx) {
    var txInfo = sbx.properties.txage;

    if (txInfo.notification) {
      var notification = _.extend({}, txInfo.notification, {
        plugin: txage
        , debug: {
          age: tx.age
        }
      });
      sbx.notifications.requestNotify(notification);
    }
  };

  txage.findLatestTimeChange = function findLatestTimeChange (sbx) {

    var prefs = txage.getPrefs(sbx);

    var txInfo = {
      found: false
      , age: 0
      , treatmentDate: null
      , checkForAlert: false
    };

    var prevDate = 0;

    _.each(sbx.data.sitechangeTreatments, function eachTreatment (treatment) {
      var treatmentDate = treatment.mills;
      if (treatmentDate > prevDate && treatmentDate <= sbx.time) {

        prevDate = treatmentDate;
        txInfo.treatmentDate = treatmentDate;

        var a = moment(sbx.time);
        var b = moment(txInfo.treatmentDate);
        var days = a.diff(b,'days');
        var hours = a.diff(b,'hours') - days * 24;
        var age = a.diff(b,'hours');

        if (!txInfo.found || (age >= 0 && age < txInfo.age)) {
          txInfo.found = true;
          txInfo.age = age;
          txInfo.days = days;
          txInfo.hours = hours;
          txInfo.notes = treatment.notes;
          txInfo.minFractions = a.diff(b,'minutes') - age * 60;
        }
      }
    });

    txInfo.level = levels.NONE;

    var sound = 'incoming';
    var message;
    var sendNotification = false;

    if (txInfo.age >= prefs.urgent) {
      sendNotification = txInfo.age === prefs.urgent;
      message = translate('Transmitter change overdue!');
      sound = 'persistent';
      txInfo.level = levels.URGENT;
    } else if (txInfo.age >= prefs.warn) {
      sendNotification = txInfo.age === prefs.warn;
      message = translate('Time to change Transmitter');
      txInfo.level = levels.WARN;
    } else  if (txInfo.age >= prefs.info) {
      sendNotification = txInfo.age === prefs.info;
      message = 'Change transmitter soon';
      txInfo.level = levels.INFO;
    }

    if (prefs.display === 'days' && txInfo.found) {
      txInfo.display = '';
      if (txInfo.age >= 24) {
        txInfo.display += txInfo.days + 'd';
      }
      txInfo.display += txInfo.hours + 'h';
    } else {
      txInfo.display = txInfo.found ? txInfo.age + 'h' : 'n/a ';
    }

    //allow for 20 minute period after a full hour during which we'll alert the user
    if (prefs.enableAlerts && sendNotification && txInfo.minFractions <= 20) {
      txInfo.notification = {
        title: translate('Transmitter age %1 hours', { params: [txInfo.age] })
        , message: message
        , pushoverSound: sound
        , level: txInfo.level
        , group: 'TXAGE'
      };
    }

    return txInfo;
  };

  txage.updateVisualisation = function updateVisualisation (sbx) {

    var txInfo = sbx.properties.txage;

    var info = [{ label: translate('Inserted'), value: new Date(txInfo.treatmentDate).toLocaleString() }];

    if (!_.isEmpty(txInfo.notes)) {
      info.push({label: translate('Notes') + ':', value: txInfo.notes});
    }

    var statusClass = null;
    if (txInfo.level === levels.URGENT) {
      statusClass = 'urgent';
    } else if (txInfo.level === levels.WARN) {
      statusClass = 'warn';
    }

    sbx.pluginBase.updatePillText(txage, {
      value: txInfo.display
      , label: translate('TXAGE')
      , info: info
      , pillClass: statusClass
    });
  };
  return txage;
}

module.exports = init;

