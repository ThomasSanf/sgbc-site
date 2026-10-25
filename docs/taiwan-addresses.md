# Taiwan delivery addresses

`lib/taiwan-locations.json` contains 22 cities/counties and 368 administrative
districts/townships, with Traditional Chinese names, English names and three-digit
postal prefixes. It is bundled locally so checkout does not depend on a live
address lookup service.

Source: Chunghwa Post, [county/township bilingual XML](https://www.post.gov.tw/post/download/County_h_10906.xml),
linked from its [official downloads](https://www.post.gov.tw/post/internet/Download/all_list.jsp).
Retrieved 2026-10-25. The XML is dated 2020-06-12 and remains the currently linked
XML version. The three non-administrative postal entries are omitted from these
administrative dropdowns. Distinct districts sharing a postal prefix (such as
Hsinchu City and Chiayi City) remain separate options.

English and Chinese labels submit the same canonical Traditional Chinese values.
Changing the city clears the district and postal code; selecting a district fills
its three-digit prefix. A customer may enter their full five/six-digit code. The
server verifies the city/district pair and matching postal prefix, and only allows
Taiwan in both sandbox and live checkout. Japan, Singapore and France are shown
as disabled upcoming destinations.

To refresh, download the XML from the official list, group rows by city/county,
retain administrative districts, and review names and counts before replacing the
JSON. Run the address tests and verify the dropdowns in both languages.
