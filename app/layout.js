export const metadata = {
  title: 'RoutineOS',
  description: 'กิจวัตรประจำวันส่วนตัว',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body style={{ fontFamily: "sans-serif", padding: "20px" }}>
        {children}
      </body>
    </html>
  );
}