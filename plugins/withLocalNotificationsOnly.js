const { withEntitlementsPlist } = require('expo/config-plugins');

// Le SDK 57 ajoute APNs même lorsque seules les alertes locales sont utilisées.
module.exports = function withLocalNotificationsOnly(config) {
  return withEntitlementsPlist(config, (updated) => {
    delete updated.modResults['aps-environment'];
    return updated;
  });
};
