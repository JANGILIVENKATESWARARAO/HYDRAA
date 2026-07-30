self.addEventListener("notificationclick", (event) => {
  const notification = event.notification;
  const action =
    event.action || notification?.data?.action || "hydraa-open-reminder";

  notification?.close();

  event.waitUntil(
    (async () => {
      const openWindows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      const payload = {
        type: "HYDRAA_NOTIFICATION_ACTION",
        action,
      };

      if (openWindows.length > 0) {
        const target = openWindows[0];
        target.focus();
        target.postMessage(payload);
        return;
      }

      if (self.clients.openWindow) {
        const url = new URL(self.registration.scope).origin;
        const openedClient = await self.clients.openWindow(url);
        if (openedClient) {
          openedClient.postMessage(payload);
        }
      }
    })(),
  );
});
