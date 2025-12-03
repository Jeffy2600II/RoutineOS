export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        <link rel="manifest" href="/manifest.json" />
        {/* เพิ่ม script ตรวจ version */}
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              var LOCAL_VERSION = window.localStorage.getItem("ROUTINEOS_VERSION");
              function checkManifestVersion() {
                fetch("/manifest.json")
                  .then(res => res.json())
                  .then(data => {
                    if (data.version) {
                      if (!LOCAL_VERSION) {
                        window.localStorage.setItem("ROUTINEOS_VERSION", data.version);
                      } else if (LOCAL_VERSION !== data.version) {
                        window.localStorage.setItem("ROUTINEOS_VERSION", data.version);
                        location.reload(true);
                      }
                    }
                  });
              }
              setInterval(checkManifestVersion, 30000); // เช็คทุก 30 วินาที
              checkManifestVersion(); // เช็คทันที
            })();
          `
        }} />
      </head>
      <body style={{ fontFamily: "sans-serif", padding: "20px" }}>
        {children}
      </body>
    </html>
  );
}