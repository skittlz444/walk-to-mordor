export function renderHomePage() {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Walk to Mordor</title>
      </head>
      <body>
        <p>Redirecting...</p>
        <script>
          (async function () {
            const token = localStorage.getItem('sessionToken');
            if (!token) {
              window.location.replace('/login');
              return;
            }

            try {
              const response = await fetch('/api/session', {
                headers: {
                  Authorization: 'Bearer ' + token,
                },
              });

              if (!response.ok) {
                localStorage.removeItem('sessionToken');
                try {
                  localStorage.removeItem('defaultViewMap');
                } catch (e) {
                  // localStorage may be unavailable
                }
                window.location.replace('/login');
                return;
              }

              const sessionData = await response.json();
              const defaultViewMap = sessionData.defaultViewMap === true;

              try {
                localStorage.setItem('defaultViewMap', defaultViewMap ? 'true' : 'false');
              } catch (e) {
                // localStorage may be unavailable
              }

              window.location.replace(defaultViewMap ? '/map' : '/journey');
            } catch (error) {
              // Network fallback: use cached preference if available.
              try {
                if (localStorage.getItem('defaultViewMap') === 'true') {
                  window.location.replace('/map');
                  return;
                }
              } catch (e) {
                // localStorage may be unavailable
              }

              window.location.replace('/journey');
            }
          })();
        </script>
      </body>
    </html>
  `;
}
