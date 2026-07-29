const admin = require('firebase-admin');

if (!admin.getApps().length) {
  admin.initializeApp({
    credential: admin.cert({
      type: "service_account",
      project_id: "parivar-18276",
      private_key_id: "5266606b7a391c087e2fb44b8b41ba3a01f4d278",
      private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC5NaS8i6xURhro\no2ry7XlOgPl+fc6+UnZVjxhe10qarxgRaiDsionNpXxMdaQBdNP2qo/1Z09rzK7n\nqBdn8Z5TFEN0IlDmrIZ08983hRY0jSviYNRIl0RwgiBO+JszLdSEHSmjPBY+VDnQ\nQOBATQsX5bywizjWetZAYiSIjuZWTQ0DkwP8z7UlBIHOtVNaWR94D63ciH47m08E\ncDt7zrg+gYlw2YV02vWxk9nMSj0671ELcqHrDXgsnwApnyOQTHKupEpu0v+cWNdi\nHlulqt08aVFdQa8Nz/b6nLH01IE4VM2qgiaurMQfsFYpnxJ6j3jdm2QvqxeyqDAj\n0iNWciPNAgMBAAECggEAVLQEYdiNGUOwpcmrLWvPCUiyEhgOd/t1tB6L+kADFihS\n3RAI+7VGXb870CoTNjlMgWizCvxTFc2YBklZXwfhLUS8rr3M+xpXKeCoqxcaNzGD\nKva2z3Yi7kOM7CEFtcvVgBBoTQe7cokJocUx6iZyFt1SRPl/JpQqLWrVI4EbNccj\nIVdvsAtRrhOSteRNGNwL+NCbOTBV0BEAUD0a0wubZuBCTrP9XZayXmLhT0cJN8yU\ntxd8BF5jdx915iHy4uh+cr3N17CeGffRaabtMvEN7PhJUBj1M1qwQzZjThmy31/4\nDwlYzwGpev7SJzp2ofpNiE82uIc0zuit5XmLnYSPDwKBgQDeHv2DiFthtAF5wk8M\nIaBcRzaCTgLDwSwKN0yG0XYETEqk8aVnNlqD/yWz+2D//cVT5gmAOluuuJGqwfCT\nkJqC5BaTpMKmi0hhelKi0HhB+wGpR0HMVgmeOtbfOQ7UMx+OptkRQFCBnniXtbiv\nXN2f1LPBeJg0s3mIWKF2MZ1YawKBgQDVdWUCUs1aU5by+THSn/HZSKFpwVZn9oJq\nMC75qfZ1aYQZTY434TkhS0bJ0nZu5yXOzfkb6uqG/GQaZLCDlMg2mG+nFiClb822\nX9j0GvbJCTGWry7Yvk9KWGS8UlKscXStezu5V26QSJQnXziGQlUkVSzg6Ol+TL6h\nl21Kzf3ipwKBgGNygJKJVFCUJSz8gCOwUnm+MHt6reYy8KLKS2r5ENuvxKPAxQtG\n3JPIgnroi29RkS2VCp/sgOvjGuTW2/1VergroqgL1lJ2fbuW5rSanZz84quFicIQ\nq1G6ikV66Fa9ZN2beggtQV4nM1rJM5zf+SH8O1bdxVejG0CeXfvrDsVtAoGAXLm7\nYDAB/qvzFadEil9qmt3fKGaRF2ZRLrmxnkjDxCtK9AbpscKHo7vki0V+pxyIIvb8\nsLDyoiK/hWuZ9f7KnlTHo8iL8/HGZePrBdc0vw3cWb3N1t+M6BnP4LLOMRSz/6xZ\nvGCLqeetXBEUJ9Zmz/qkHStwSqoh4WY7VtR25l8CgYEApPSnm2/D+XryiRo/4pox\nOEE2LNDwSQ1fcnu14tvT4ELrnDc8yhd7T8nIbWI+U6OnWEzBjFlSKANZwubqYiPi\nWeyPo//MT0cMWg1v01YL9H8VKLHACvUOlHVtKGzSjfi8dvN6edaS/6qpKfFtIYXe\nxfkN9RNmDGTFKZSSqCWVGKg=\n-----END PRIVATE KEY-----\n",
      client_email: "firebase-adminsdk-fbsvc@parivar-18276.iam.gserviceaccount.com",
      client_id: "100958266496058072928",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40parivar-18276.iam.gserviceaccount.com"
    })
  });
}

module.exports = admin;
