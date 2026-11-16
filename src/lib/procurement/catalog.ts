// Static reference data for TenderAtlas. Pure module: safe in browser and server.
export type SourceKey = "ted" | "gr" | "uk" | "fr" | "wb" | "sam";

export const SOURCES: Record<
  SourceKey,
  { label: string; name: string; region: string; docs: string; supportsCpv: boolean; detailPages: boolean }
> = {
  ted: { label: "EU · TED", name: "Tenders Electronic Daily", region: "European Union & EEA", docs: "https://docs.ted.europa.eu/api/latest/search.html", supportsCpv: true, detailPages: true },
  fr: { label: "FR · BOAMP", name: "Bulletin officiel des annonces des marchés publics", region: "France", docs: "https://boamp-datadila.opendatasoft.com/explore/dataset/boamp/api/", supportsCpv: true, detailPages: true },
  wb: { label: "World Bank", name: "World Bank Procurement Notices", region: "Global (World Bank-financed)", docs: "https://search.worldbank.org/api/v2/procnotices", supportsCpv: false, detailPages: true },
  gr: { label: "GR · KIMDIS", name: "Κεντρικό Ηλεκτρονικό Μητρώο Δημοσίων Συμβάσεων", region: "Greece", docs: "https://cerpp.eprocurement.gov.gr/khmdhs-opendata/help", supportsCpv: true, detailPages: true },
  uk: { label: "UK · Find a Tender", name: "Find a Tender Service", region: "United Kingdom", docs: "https://www.find-tender.service.gov.uk/Developer/Documentation", supportsCpv: true, detailPages: true },
  sam: { label: "US · SAM.gov", name: "SAM.gov Contract Opportunities", region: "United States", docs: "https://open.gsa.gov/api/get-opportunities-public-api/", supportsCpv: false, detailPages: true },
};
export const SOURCE_KEYS = Object.keys(SOURCES) as SourceKey[];
export const isSourceKey = (s: string): s is SourceKey => Object.hasOwn(SOURCES, s);

/** Countries with their own directory page. iso2 lower-case is the URL slug. */
export const COUNTRIES: { iso2: string; iso3: string; name: string; sources: SourceKey[] }[] = ([
  ["at", "AUT", "Austria"], ["be", "BEL", "Belgium"], ["bg", "BGR", "Bulgaria"], ["hr", "HRV", "Croatia"],
  ["cy", "CYP", "Cyprus"], ["cz", "CZE", "Czechia"], ["dk", "DNK", "Denmark"], ["ee", "EST", "Estonia"],
  ["fi", "FIN", "Finland"], ["fr", "FRA", "France"], ["de", "DEU", "Germany"], ["gr", "GRC", "Greece"],
  ["hu", "HUN", "Hungary"], ["ie", "IRL", "Ireland"], ["it", "ITA", "Italy"], ["lv", "LVA", "Latvia"],
  ["lt", "LTU", "Lithuania"], ["lu", "LUX", "Luxembourg"], ["mt", "MLT", "Malta"], ["nl", "NLD", "Netherlands"],
  ["no", "NOR", "Norway"], ["pl", "POL", "Poland"], ["pt", "PRT", "Portugal"], ["ro", "ROU", "Romania"],
  ["sk", "SVK", "Slovakia"], ["si", "SVN", "Slovenia"], ["es", "ESP", "Spain"], ["se", "SWE", "Sweden"],
  ["ch", "CHE", "Switzerland"], ["is", "ISL", "Iceland"], ["gb", "GBR", "United Kingdom"], ["us", "USA", "United States"],
] as [string, string, string][]).map(([iso2, iso3, name]) => ({
  iso2, iso3, name,
  sources: (iso3 === "GBR" ? ["uk"] : iso3 === "USA" ? ["sam"] : ["ted", ...(iso3 === "FRA" ? ["fr"] : []), ...(iso3 === "GRC" ? ["gr"] : [])] as SourceKey[]),
}));
export const countryBySlug = (slug: string) => COUNTRIES.find((c) => c.iso2 === slug.toLowerCase());
export const countryByIso3 = (iso3?: string | null) => COUNTRIES.find((c) => c.iso3 === iso3);

/** CPV 2008 divisions (first two digits + six zeros). Names from the official CPV regulation. */
export const CPV_DIVISIONS: { code: string; name: string }[] = ([
  ["03000000", "Agricultural, farming, fishing, forestry and related products"],
  ["09000000", "Petroleum products, fuel, electricity and other sources of energy"],
  ["14000000", "Mining, basic metals and related products"],
  ["15000000", "Food, beverages, tobacco and related products"],
  ["16000000", "Agricultural machinery"],
  ["18000000", "Clothing, footwear, luggage articles and accessories"],
  ["19000000", "Leather and textile fabrics, plastic and rubber materials"],
  ["22000000", "Printed matter and related products"],
  ["24000000", "Chemical products"],
  ["30000000", "Office and computing machinery, equipment and supplies"],
  ["31000000", "Electrical machinery, apparatus, equipment and consumables; lighting"],
  ["32000000", "Radio, television, communication, telecommunication and related equipment"],
  ["33000000", "Medical equipments, pharmaceuticals and personal care products"],
  ["34000000", "Transport equipment and auxiliary products to transportation"],
  ["35000000", "Security, fire-fighting, police and defence equipment"],
  ["37000000", "Musical instruments, sport goods, games, toys, handicraft, art materials"],
  ["38000000", "Laboratory, optical and precision equipments (excl. glasses)"],
  ["39000000", "Furniture, furnishings, domestic appliances and cleaning products"],
  ["41000000", "Collected and purified water"],
  ["42000000", "Industrial machinery"],
  ["43000000", "Machinery for mining, quarrying, construction equipment"],
  ["44000000", "Construction structures and materials; auxiliary products to construction"],
  ["45000000", "Construction work"],
  ["48000000", "Software package and information systems"],
  ["50000000", "Repair and maintenance services"],
  ["51000000", "Installation services (except software)"],
  ["55000000", "Hotel, restaurant and retail trade services"],
  ["60000000", "Transport services (excl. waste transport)"],
  ["63000000", "Supporting and auxiliary transport services; travel agencies services"],
  ["64000000", "Postal and telecommunications services"],
  ["65000000", "Public utilities"],
  ["66000000", "Financial and insurance services"],
  ["70000000", "Real estate services"],
  ["71000000", "Architectural, construction, engineering and inspection services"],
  ["72000000", "IT services: consulting, software development, Internet and support"],
  ["73000000", "Research and development services and related consultancy services"],
  ["75000000", "Administration, defence and social security services"],
  ["76000000", "Services related to the oil and gas industry"],
  ["77000000", "Agricultural, forestry, horticultural, aquacultural and apicultural services"],
  ["79000000", "Business services: law, marketing, consulting, recruitment, printing and security"],
  ["80000000", "Education and training services"],
  ["85000000", "Health and social work services"],
  ["90000000", "Sewage, refuse, cleaning and environmental services"],
  ["92000000", "Recreational, cultural and sporting services"],
  ["98000000", "Other community, social and personal services"],
] as [string, string][]).map(([code, name]) => ({ code, name }));
export const cpvDivision = (code: string) => CPV_DIVISIONS.find((d) => d.code === code);
export const cpvDivisionFor = (code: string) => CPV_DIVISIONS.find((d) => d.code.slice(0, 2) === String(code).slice(0, 2));
