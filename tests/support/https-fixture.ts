// modesta - Lightweight swagger proxy generator
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/modesta/

import { createServer, type Server as HttpsServer } from 'https';
import type { IncomingMessage, ServerResponse } from 'http';

const selfSignedLocalhostKey = `-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQC5OuvKtmF6y17R
RiKQAq3oXVZfk1Ao7rVvTJ3P6OWnes4B1cM2TKOJJib+NyF8NQ5EldZIK8YRE6ih
lD3ZvVBsW8xA/xdZrnBWan+YkDqF1uygpyRIY6H8EtNpsC5JxjXwclzqrxQoEpgK
eXgAvA3I7dE1JzDxElVpE2FyGIEH/dgKThfRIT5tPVyLJRUyH6X6U/3OLwoMI5p5
LCzALUR84RF72BCMO4NWBAyj3Ew558ukkIjYtQWZggt8E5VT0xBvucDGd3DsqBZP
9s4GNwsLvuKHvlM0Hhf4rgh2I5j0FBrWb8Zd7ycqKD+lK1SD3izlS1XR5DoQLk9V
Z/shAHXvAgMBAAECggEAVT0CjdXQ1O+qcfZq6Ed7XP86xJ+nVzbGQnII+0irCh+u
llSW0TGCXhYzAnA/VgeaScCEC9EtA+W+h6COt9jxHfQ+cbiRt8DYzEOU9RGGBNor
KSDRRwimXbgSFsQvAN8YKk6OaKbpySkJU2Sjbv8a/thFmkavNHih2klDYfxZwGFt
HMV5Mp+9PkfFe1jpvT+tSzL9tfPRv4xBCgwX5u659/gPGCu3NwPArBqKKxH3httD
CDW+Ffi+NIrofxTcdijryx+iKRPY/GlCBh/wjBn90yD1Dz957kkVN3uLfyla1yHH
KDqcINQiZesWTwr7+8SuJ+k6r2Ev2mKLkv8/IWVkgQKBgQDgSgtreE2E7hOA268G
up+H+3yT9Sjk+CTYbdxkQrUjEY5zAiY/TWzL9No9MI/oP+h3GgZPnNLTHugeQ/sG
/hxL5LCcSkyxOeXNTR5GjYXa6HdANvoST9aPtgoWOIELEZUs4MAbDCepYDBBIIDb
LWwjI9hmfN8TYP4XjgUnRjxlgQKBgQDTayq5JZQOzkwbYcnE69K49lrUJ15EL28l
EXxj/Y82KdaL6uckm9qzUsGuBqp1iEDjRE3KoaHch9NLtXNqmAf+lS8vfRIpUGaY
7U1mxOsdNRyatC3g4WbWeQCxDlEyQpjihpHVWcgb7dHptjtgXvMUqZ9tLV8aA8Bi
/Teg6ffzbwKBgQCQ1h/zwZdFnTxI/RRUoxU8CeHT5gAHhFq+zIsCz7ULNV4o1J2A
SW5VcwOvefmkQAjNSKgEpz/Zh97bFIk5ZcU+GSsXcj9+PuYwInnHk8J5r566gAYS
5y2mVibDXK+wRyVu+p/zl3DRRsVCeUvcvcNUGeS3ojGn4P2UlmiriQadgQKBgQCp
CUNEez4wxFLnhb0cHG0EA7zFaaCeJcrYuW1aSQ4rATKP9kXO6Gno/J7sdFnv1PwE
ecU04RyYRWT0YGSicmHZ9A+hCX/u1mDhnsJHC+TsGl3/d1ZDOhTOIDskVU0oQUUZ
wPxyt/EeG3y9Pz2kJOZ3u9NDKIakNyGoQ8spdkgQMwKBgQDZTH8wnqWGODYZFc9J
y6ZsneeNDPe0H9ZhaDhKAT0DhEhW5w2Hg7tIQvgI2+Z1q6/NJZw19uUjWxuLSeCc
gyQ8w7JFcU5n+Ibk5H/0AwuUdZTtCBWi/qtn7A14L46EZeDg7kzIjuCt9DJ2ikUx
6kEEoHqcSOb/jFHuo+KD9jQ4Zg==
-----END PRIVATE KEY-----
`;

const selfSignedLocalhostCert = `-----BEGIN CERTIFICATE-----
MIIC8zCCAdugAwIBAgIUfrSMqgZe4eqTGPIIX5V//faFxcowDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJMTI3LjAuMC4xMB4XDTI2MDQxNTExNDMwMVoXDTM2MDQx
MjExNDMwMVowFDESMBAGA1UEAwwJMTI3LjAuMC4xMIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAuTrryrZheste0UYikAKt6F1WX5NQKO61b0ydz+jlp3rO
AdXDNkyjiSYm/jchfDUORJXWSCvGEROooZQ92b1QbFvMQP8XWa5wVmp/mJA6hdbs
oKckSGOh/BLTabAuScY18HJc6q8UKBKYCnl4ALwNyO3RNScw8RJVaRNhchiBB/3Y
Ck4X0SE+bT1ciyUVMh+l+lP9zi8KDCOaeSwswC1EfOERe9gQjDuDVgQMo9xMOefL
pJCI2LUFmYILfBOVU9MQb7nAxndw7KgWT/bOBjcLC77ih75TNB4X+K4IdiOY9BQa
1m/GXe8nKig/pStUg94s5UtV0eQ6EC5PVWf7IQB17wIDAQABoz0wOzAaBgNVHREE
EzARgglsb2NhbGhvc3SHBH8AAAEwHQYDVR0OBBYEFEz4TbEEsPqoQ8KDh55HOLxv
m6LQMA0GCSqGSIb3DQEBCwUAA4IBAQAvjdvNFMcMq5UhGzshXh/vMh2BbDzSQp6L
yqeo216rQ+YFY2Cp5vA0/BNYF2wSI6pfwxILYNxjC95Xu74NVmmynJGI7GkdTSYP
R7q5ZrP2gu66g/LEOdefXBG7A/BDL740vUOhc+NfxGBfHfVwYXbum2aKB+ypAT4h
+peNwp0P7oHnZK2w5WiS3WlDzi3MhVJDW9a26sq7f19JejJFxmwon/KL6yTD6vtL
nnTBZ3lfFi0+lqchiW+XjxLcdLgT/j9WDymG5cKXZlj1DC3653I0jitVTit5rin6
UBu9l8pYc7iNTK6nxPIY+BkEnuirCm9Fii39aPW/l5T7aGERscuh
-----END CERTIFICATE-----
`;

export const createSelfSignedHttpsServer = (
  listener: (
    request: IncomingMessage,
    response: ServerResponse<IncomingMessage>
  ) => void
): HttpsServer => {
  return createServer(
    {
      cert: selfSignedLocalhostCert,
      key: selfSignedLocalhostKey,
    },
    listener
  );
};
