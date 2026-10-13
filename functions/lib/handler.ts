import type { AuthEnv, Creation, Store } from "./types.ts";
import { gridThumbUrl } from "./mediaThumbs.ts";
import { displayModel } from "./modelLabel.ts";
import { cleanDisplayPrompt } from "./promptClean";

const MODELS = ["Flux", "Midjourney", "DALL·E", "Ideogram", "Grok"];

function curatedPoster(creation: Pick<Creation, "mediaKind" | "mediaUrl">): string | undefined {
  if (creation.mediaKind !== "video") return undefined;
  if (creation.mediaUrl === "/media/video/us-cities-detroit-riverfront.mp4") {
    return "/media/posters/us-cities-detroit-riverfront.jpg?v=20261002detroit2";
  }
  if (creation.mediaUrl === "/media/video/us-cities-honolulu-waikiki.mp4") {
    return "/media/posters/us-cities-honolulu-waikiki.jpg?v=20261002honolulu1";
  }
  if (creation.mediaUrl === "/media/video/us-cities-pittsburgh-point.mp4") {
    return "/media/posters/us-cities-pittsburgh-point.jpg?v=20261002pittsburgh1";
  }
  if (creation.mediaUrl === "/media/video/us-cities-salt-lake-wasatch.mp4") {
    return "/media/posters/us-cities-salt-lake-wasatch.jpg?v=20261002saltlake60";
  }
  if (creation.mediaUrl === "/media/video/us-cities-charleston-battery.mp4") {
    return "/media/posters/us-cities-charleston-battery.jpg?v=20261002charleston60";
  }
  if (creation.mediaUrl === "/media/video/us-cities-seattle-elliott.mp4") {
    return "/media/posters/us-cities-seattle-elliott.jpg?v=20261002seattle60";
  }
  if (creation.mediaUrl === "/media/video/us-cities-new-orleans-rooftops.mp4") {
    return "/media/posters/us-cities-new-orleans-rooftops.jpg?v=20261002nola60";
  }
  if (creation.mediaUrl === "/media/video/us-cities-austin-lake.mp4") {
    return "/media/posters/us-cities-austin-lake.jpg?v=20261002austin60";
  }
  if (creation.mediaUrl === "/media/video/us-cities-miami-biscayne.mp4") {
    return "/media/posters/us-cities-miami-biscayne.jpg?v=20261002miami60";
  }
  if (creation.mediaUrl === "/media/video/us-cities-boston-zakim.mp4") {
    return "/media/posters/us-cities-boston-zakim.jpg?v=20261002boston60";
  }
  if (creation.mediaUrl === "/media/video/us-cities-denver-foothills.mp4") {
    return "/media/posters/us-cities-denver-foothills.jpg?v=20261002denver60";
  }
  if (creation.mediaUrl === "/media/video/us-cities-philadelphia-schuylkill.mp4") {
    return "/media/posters/us-cities-philadelphia-schuylkill.jpg?v=20261002philly60";
  }
  if (creation.mediaUrl === "/media/video/us-cities-nashville-cumberland.mp4") {
    return "/media/posters/us-cities-nashville-cumberland.jpg?v=20261002nashville60";
  }
  if (creation.mediaUrl === "/media/video/us-cities-portland-bridges.mp4") {
    return "/media/posters/us-cities-portland-bridges.jpg?v=20261002portland60";
  }
  if (creation.mediaUrl === "/media/video/us-cities-chicago-riverwalk.mp4") {
    return "/media/posters/us-cities-chicago-riverwalk.jpg?v=20261003chicago1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-st-louis-arch.mp4") {
    return "/media/posters/us-cities-st-louis-arch.jpg?v=20261003stlouis1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-baltimore-harbor.mp4") {
    return "/media/posters/us-cities-baltimore-harbor.jpg?v=20261003balti1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-savannah-river.mp4") {
    return "/media/posters/us-cities-savannah-river.jpg?v=20261003sav1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-san-antonio-river.mp4") {
    return "/media/posters/us-cities-san-antonio-river.jpg?v=20261003sa1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-cleveland-lake.mp4") {
    return "/media/posters/us-cities-cleveland-lake.jpg?v=20261003cle1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-kansas-city-skyline.mp4") {
    return "/media/posters/us-cities-kansas-city-skyline.jpg?v=20261003kc1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-cincinnati-river.mp4") {
    return "/media/posters/us-cities-cincinnati-river.jpg?v=20261003cin1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-milwaukee-lake.mp4") {
    return "/media/posters/us-cities-milwaukee-lake.jpg?v=20261003mke1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-providence-water.mp4") {
    return "/media/posters/us-cities-providence-water.jpg?v=20261003prov1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-richmond-river.mp4") {
    return "/media/posters/us-cities-richmond-river.jpg?v=20261003ric1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-albuquerque-plaza.mp4") {
    return "/media/posters/us-cities-albuquerque-plaza.jpg?v=20261003abq1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-anchorage-coast.mp4") {
    return "/media/posters/us-cities-anchorage-coast.jpg?v=20261003anc1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-boise-foothills.mp4") {
    return "/media/posters/us-cities-boise-foothills.jpg?v=20261003boi1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-tucson-downtown.mp4") {
    return "/media/posters/us-cities-tucson-downtown.jpg?v=20261003tuc1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-glacier-lagoon.mp4") {
    return "/media/posters/landscapes-glacier-lagoon.jpg?v=20261003glag1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-badlands-buttes.mp4") {
    return "/media/posters/landscapes-badlands-buttes.jpg?v=20261003badl1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-sea-stacks.mp4") {
    return "/media/posters/landscapes-sea-stacks.jpg?v=20261003seas1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-larch-valley.mp4") {
    return "/media/posters/landscapes-larch-valley.jpg?v=20261003larch1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-basalt-coast.mp4") {
    return "/media/posters/landscapes-basalt-coast.jpg?v=20261003basa1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-wildflower-desert.mp4") {
    return "/media/posters/landscapes-wildflower-desert.jpg?v=20261003wild1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-canyon-river.mp4") {
    return "/media/posters/landscapes-canyon-river.jpg?v=20261003canr1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-snow-volcano.mp4") {
    return "/media/posters/landscapes-snow-volcano.jpg?v=20261003svol1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-cottonwood-river.mp4") {
    return "/media/posters/landscapes-cottonwood-river.jpg?v=20261003cott1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-hoodoo-basin.mp4") {
    return "/media/posters/landscapes-hoodoo-basin.jpg?v=20261003hood1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-fjord-village.mp4") {
    return "/media/posters/landscapes-fjord-village.jpg?v=20261003fjsh1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-salt-marsh.mp4") {
    return "/media/posters/landscapes-salt-marsh.jpg?v=20261003saltm1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-joshua-dusk.mp4") {
    return "/media/posters/landscapes-joshua-dusk.jpg?v=20261003josh1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-waterfall-pool-v2.mp4") {
    return "/media/posters/landscapes-waterfall-pool-v2.jpg?v=20261003wpool60c";
  }
  if (creation.mediaUrl === "/media/video/landscapes-tundra-river.mp4") {
    return "/media/posters/landscapes-tundra-river.jpg?v=20261003tund1080";
  }
  if (creation.mediaUrl === "/media/video/cities-kyoto-kamo.mp4") {
    return "/media/posters/cities-kyoto-kamo.jpg?v=20261003citieskyot60";
  }
  if (creation.mediaUrl === "/media/video/cities-venice-dawn.mp4") {
    return "/media/posters/cities-venice-dawn.jpg?v=20261003citiesveni60";
  }
  if (creation.mediaUrl === "/media/video/cities-rio-hill.mp4") {
    return "/media/posters/cities-rio-hill.jpg?v=20261003citiesrioh60";
  }
  if (creation.mediaUrl === "/media/video/cities-singapore-marina.mp4") {
    return "/media/posters/cities-singapore-marina.jpg?v=20261003citiessing60";
  }
  if (creation.mediaUrl === "/media/video/cities-barcelona-gothic.mp4") {
    return "/media/posters/cities-barcelona-gothic.jpg?v=20261003citiesbarc60";
  }
  if (creation.mediaUrl === "/media/video/cities-amsterdam-canal.mp4") {
    return "/media/posters/cities-amsterdam-canal.jpg?v=20261003citiesamst60";
  }
  if (creation.mediaUrl === "/media/video/cities-seoul-han.mp4") {
    return "/media/posters/cities-seoul-han.jpg?v=20261003citiesseou60";
  }
  if (creation.mediaUrl === "/media/video/cities-dubrovnik-walls.mp4") {
    return "/media/posters/cities-dubrovnik-walls.jpg?v=20261003citiesdubr60";
  }
  if (creation.mediaUrl === "/media/video/cities-valparaiso-hills.mp4") {
    return "/media/posters/cities-valparaiso-hills.jpg?v=20261003citiesvalp60";
  }
  if (creation.mediaUrl === "/media/video/cities-bergen-harbor.mp4") {
    return "/media/posters/cities-bergen-harbor.jpg?v=20261003citiesberg60";
  }
  if (creation.mediaUrl === "/media/video/cities-queenstown-lake.mp4") {
    return "/media/posters/cities-queenstown-lake.jpg?v=20261003citiesquee60";
  }
  if (creation.mediaUrl === "/media/video/cities-luang-river.mp4") {
    return "/media/posters/cities-luang-river.jpg?v=20261003citiesluan60";
  }
  if (creation.mediaUrl === "/media/video/cities-santorini-caldera.mp4") {
    return "/media/posters/cities-santorini-caldera.jpg?v=20261003citiessant60";
  }
  if (creation.mediaUrl === "/media/video/cities-budapest-bridge.mp4") {
    return "/media/posters/cities-budapest-bridge.jpg?v=20261003citiesbuda60";
  }
  if (creation.mediaUrl === "/media/video/cities-vancouver-seawall.mp4") {
    return "/media/posters/cities-vancouver-seawall.jpg?v=20261003citiesvanc60";
  }
  if (creation.mediaUrl === "/media/video/street-tokyo-alley.mp4") {
    return "/media/posters/street-tokyo-alley.jpg?v=20261003streettoky60";
  }
  if (creation.mediaUrl === "/media/video/street-lisbon-tram.mp4") {
    return "/media/posters/street-lisbon-tram.jpg?v=20261003streetlisb60";
  }
  if (creation.mediaUrl === "/media/video/street-new-orleans.mp4") {
    return "/media/posters/street-new-orleans.jpg?v=20261003streetnewo60";
  }
  if (creation.mediaUrl === "/media/video/street-seoul-neon.mp4") {
    return "/media/posters/street-seoul-neon.jpg?v=20261003streetseou60";
  }
  if (creation.mediaUrl === "/media/video/street-paris-rain.mp4") {
    return "/media/posters/street-paris-rain.jpg?v=20261003streetpari60";
  }
  if (creation.mediaUrl === "/media/video/street-oaxaca-market.mp4") {
    return "/media/posters/street-oaxaca-market.jpg?v=20261003streetoaxa60";
  }
  if (creation.mediaUrl === "/media/video/street-melbourne-lane.mp4") {
    return "/media/posters/street-melbourne-lane.jpg?v=20261003streetmelb60";
  }
  if (creation.mediaUrl === "/media/video/street-hongkong-street.mp4") {
    return "/media/posters/street-hongkong-street.jpg?v=20261003streethong60";
  }
  if (creation.mediaUrl === "/media/video/street-rome-cobble.mp4") {
    return "/media/posters/street-rome-cobble.jpg?v=20261003streetrome60";
  }
  if (creation.mediaUrl === "/media/video/street-copenhagen-bike.mp4") {
    return "/media/posters/street-copenhagen-bike.jpg?v=20261003streetcope60";
  }
  if (creation.mediaUrl === "/media/video/street-istanbul-lane.mp4") {
    return "/media/posters/street-istanbul-lane.jpg?v=20261003streetista60";
  }
  if (creation.mediaUrl === "/media/video/street-havana-pastel.mp4") {
    return "/media/posters/street-havana-pastel.jpg?v=20261003streethava60";
  }
  if (creation.mediaUrl === "/media/video/street-mexico-colonia.mp4") {
    return "/media/posters/street-mexico-colonia.jpg?v=20261003streetmexi60";
  }
  if (creation.mediaUrl === "/media/video/street-chefchaouen.mp4") {
    return "/media/posters/street-chefchaouen.jpg?v=20261003streetchef60";
  }
  if (creation.mediaUrl === "/media/video/street-edinburgh-close.mp4") {
    return "/media/posters/street-edinburgh-close.jpg?v=20261003streetedin60";
  }
  if (creation.mediaUrl === "/media/video/people-cafe-terrace.mp4") {
    return "/media/posters/people-cafe-terrace.jpg?v=20261003peoplecafe60";
  }
  if (creation.mediaUrl === "/media/video/people-crosswalk-dusk.mp4") {
    return "/media/posters/people-crosswalk-dusk.jpg?v=20261003peoplecros60";
  }
  if (creation.mediaUrl === "/media/video/people-night-market.mp4") {
    return "/media/posters/people-night-market.jpg?v=20261003peoplenigh60";
  }
  if (creation.mediaUrl === "/media/video/people-station-platform.mp4") {
    return "/media/posters/people-station-platform.jpg?v=20261003peoplestat60";
  }
  if (creation.mediaUrl === "/media/video/people-park-path.mp4") {
    return "/media/posters/people-park-path.jpg?v=20261003peoplepark60";
  }
  if (creation.mediaUrl === "/media/video/people-bookstore.mp4") {
    return "/media/posters/people-bookstore.jpg?v=20261003peoplebook60";
  }
  return creation.mediaUrl.replace("/media/video/", "/media/posters/").replace(/\.(webm|mp4|mov)(\?|$)/i, ".jpg$2");
}

// The first Pages deploy briefly cached the SPA fallback at this new path.
// Keep the stored mediaUrl canonical, but let app-facing media fields bypass
// that stale edge entry while it expires.
function appMediaUrl(creation: Pick<Creation, "mediaKind" | "mediaUrl">): string {
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-salt-flat.mp4") {
    return `${creation.mediaUrl}?v=20261002salt1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-highland-ridge.mp4") {
    return `${creation.mediaUrl}?v=20261002highland1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-lavender-field.mp4") {
    return `${creation.mediaUrl}?v=20261002lavender1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-bamboo-grove.mp4") {
    return `${creation.mediaUrl}?v=20261002b5`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-frozen-lake.mp4") {
    return `${creation.mediaUrl}?v=20261002frozen1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-rolling-hills.mp4") {
    return `${creation.mediaUrl}?v=20261002rolling1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-waterfall-gorge.mp4") {
    return `${creation.mediaUrl}?v=20261002waterfall1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-tropical-lagoon.mp4") {
    return `${creation.mediaUrl}?v=20261002lagoon1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-glacial-river.mp4") {
    return `${creation.mediaUrl}?v=20261002glacial1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-marsh-sunrise.mp4") {
    return `${creation.mediaUrl}?v=20261002marsh1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-black-sand-beach.mp4") {
    return `${creation.mediaUrl}?v=20261002black1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-slot-canyon.mp4") {
    return `${creation.mediaUrl}?v=20261002slotcanyon1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-chalk-cliff.mp4") {
    return `${creation.mediaUrl}?v=20261002chalk1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-rice-terrace.mp4") {
    return `${creation.mediaUrl}?v=20261002rice1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-mangrove.mp4") {
    return `${creation.mediaUrl}?v=20261002mangrove1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-wheat-field.mp4") {
    return `${creation.mediaUrl}?v=20261002wheat1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-alpine-tarn.mp4") {
    return `${creation.mediaUrl}?v=20261002alpine1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-olive-grove.mp4") {
    return `${creation.mediaUrl}?v=20261002olive1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-cedar-mist.mp4") {
    return `${creation.mediaUrl}?v=20261002cedar1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-river-delta.mp4") {
    return `${creation.mediaUrl}?v=20261002riverdelta2`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-kelp-forest.mp4") {
    return `${creation.mediaUrl}?v=20261002kelp1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-dry-lake.mp4") {
    return `${creation.mediaUrl}?v=20261002drylake1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-detroit-riverfront.mp4") {
    return `${creation.mediaUrl}?v=20261002detroit60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-honolulu-waikiki.mp4") {
    return `${creation.mediaUrl}?v=20261002honolulu60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-pittsburgh-point.mp4") {
    return `${creation.mediaUrl}?v=20261002pittsburgh60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-salt-lake-wasatch.mp4") {
    return `${creation.mediaUrl}?v=20261002saltlake60b`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-charleston-battery.mp4") {
    return `${creation.mediaUrl}?v=20261002charleston60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-seattle-elliott.mp4") {
    return `${creation.mediaUrl}?v=20261002seattle60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-new-orleans-rooftops.mp4") {
    return `${creation.mediaUrl}?v=20261002nola60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-austin-lake.mp4") {
    return `${creation.mediaUrl}?v=20261002austin60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-miami-biscayne.mp4") {
    return `${creation.mediaUrl}?v=20261002miami60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-boston-zakim.mp4") {
    return `${creation.mediaUrl}?v=20261002boston60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-denver-foothills.mp4") {
    return `${creation.mediaUrl}?v=20261002denver60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-philadelphia-schuylkill.mp4") {
    return `${creation.mediaUrl}?v=20261002philly60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-nashville-cumberland.mp4") {
    return `${creation.mediaUrl}?v=20261002nashville60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-portland-bridges.mp4") {
    return `${creation.mediaUrl}?v=20261002portland60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-chicago-riverwalk.mp4") {
    return `${creation.mediaUrl}?v=20261003chicago1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-st-louis-arch.mp4") {
    return `${creation.mediaUrl}?v=20261003stlouis1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-baltimore-harbor.mp4") {
    return `${creation.mediaUrl}?v=20261003balti1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-savannah-river.mp4") {
    return `${creation.mediaUrl}?v=20261003sav1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-san-antonio-river.mp4") {
    return `${creation.mediaUrl}?v=20261003sa1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-cleveland-lake.mp4") {
    return `${creation.mediaUrl}?v=20261003cle1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-kansas-city-skyline.mp4") {
    return `${creation.mediaUrl}?v=20261003kc1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-cincinnati-river.mp4") {
    return `${creation.mediaUrl}?v=20261003cin1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-milwaukee-lake.mp4") {
    return `${creation.mediaUrl}?v=20261003mke1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-providence-water.mp4") {
    return `${creation.mediaUrl}?v=20261003prov1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-richmond-river.mp4") {
    return `${creation.mediaUrl}?v=20261003ric1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-albuquerque-plaza.mp4") {
    return `${creation.mediaUrl}?v=20261003abq1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-anchorage-coast.mp4") {
    return `${creation.mediaUrl}?v=20261003anc1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-boise-foothills.mp4") {
    return `${creation.mediaUrl}?v=20261003boi1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-tucson-downtown.mp4") {
    return `${creation.mediaUrl}?v=20261003tuc1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-glacier-lagoon.mp4") {
    return `${creation.mediaUrl}?v=20261003glag1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-badlands-buttes.mp4") {
    return `${creation.mediaUrl}?v=20261003badl1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-sea-stacks.mp4") {
    return `${creation.mediaUrl}?v=20261003seas1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-larch-valley.mp4") {
    return `${creation.mediaUrl}?v=20261003larch1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-basalt-coast.mp4") {
    return `${creation.mediaUrl}?v=20261003basa1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-wildflower-desert.mp4") {
    return `${creation.mediaUrl}?v=20261003wild1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-canyon-river.mp4") {
    return `${creation.mediaUrl}?v=20261003canr1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-snow-volcano.mp4") {
    return `${creation.mediaUrl}?v=20261003svol1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-cottonwood-river.mp4") {
    return `${creation.mediaUrl}?v=20261003cott1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-hoodoo-basin.mp4") {
    return `${creation.mediaUrl}?v=20261003hood1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-fjord-village.mp4") {
    return `${creation.mediaUrl}?v=20261003fjsh1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-salt-marsh.mp4") {
    return `${creation.mediaUrl}?v=20261003saltm1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-joshua-dusk.mp4") {
    return `${creation.mediaUrl}?v=20261003josh1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-waterfall-pool-v2.mp4") {
    return `${creation.mediaUrl}?v=20261003wpool60c`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-tundra-river.mp4") {
    return `${creation.mediaUrl}?v=20261003tund1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-kyoto-kamo.mp4") {
    return `${creation.mediaUrl}?v=20261003citieskyot60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-venice-dawn.mp4") {
    return `${creation.mediaUrl}?v=20261003citiesveni60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-rio-hill.mp4") {
    return `${creation.mediaUrl}?v=20261003citiesrioh60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-singapore-marina.mp4") {
    return `${creation.mediaUrl}?v=20261003citiessing60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-barcelona-gothic.mp4") {
    return `${creation.mediaUrl}?v=20261003citiesbarc60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-amsterdam-canal.mp4") {
    return `${creation.mediaUrl}?v=20261003citiesamst60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-seoul-han.mp4") {
    return `${creation.mediaUrl}?v=20261003citiesseou60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-dubrovnik-walls.mp4") {
    return `${creation.mediaUrl}?v=20261003citiesdubr60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-valparaiso-hills.mp4") {
    return `${creation.mediaUrl}?v=20261003citiesvalp60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-bergen-harbor.mp4") {
    return `${creation.mediaUrl}?v=20261003citiesberg60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-queenstown-lake.mp4") {
    return `${creation.mediaUrl}?v=20261003citiesquee60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-luang-river.mp4") {
    return `${creation.mediaUrl}?v=20261003citiesluan60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-santorini-caldera.mp4") {
    return `${creation.mediaUrl}?v=20261003citiessant60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-budapest-bridge.mp4") {
    return `${creation.mediaUrl}?v=20261003citiesbuda60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-vancouver-seawall.mp4") {
    return `${creation.mediaUrl}?v=20261003citiesvanc60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-tokyo-alley.mp4") {
    return `${creation.mediaUrl}?v=20261003streettoky60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-lisbon-tram.mp4") {
    return `${creation.mediaUrl}?v=20261003streetlisb60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-new-orleans.mp4") {
    return `${creation.mediaUrl}?v=20261003streetnewo60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-seoul-neon.mp4") {
    return `${creation.mediaUrl}?v=20261003streetseou60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-paris-rain.mp4") {
    return `${creation.mediaUrl}?v=20261003streetpari60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-oaxaca-market.mp4") {
    return `${creation.mediaUrl}?v=20261003streetoaxa60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-melbourne-lane.mp4") {
    return `${creation.mediaUrl}?v=20261003streetmelb60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-hongkong-street.mp4") {
    return `${creation.mediaUrl}?v=20261003streethong60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-rome-cobble.mp4") {
    return `${creation.mediaUrl}?v=20261003streetrome60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-copenhagen-bike.mp4") {
    return `${creation.mediaUrl}?v=20261003streetcope60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-istanbul-lane.mp4") {
    return `${creation.mediaUrl}?v=20261003streetista60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-havana-pastel.mp4") {
    return `${creation.mediaUrl}?v=20261003streethava60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-mexico-colonia.mp4") {
    return `${creation.mediaUrl}?v=20261003streetmexi60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-chefchaouen.mp4") {
    return `${creation.mediaUrl}?v=20261003streetchef60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-edinburgh-close.mp4") {
    return `${creation.mediaUrl}?v=20261003streetedin60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/people-cafe-terrace.mp4") {
    return `${creation.mediaUrl}?v=20261003peoplecafe60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/people-crosswalk-dusk.mp4") {
    return `${creation.mediaUrl}?v=20261003peoplecros60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/people-night-market.mp4") {
    return `${creation.mediaUrl}?v=20261003peoplenigh60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/people-station-platform.mp4") {
    return `${creation.mediaUrl}?v=20261003peoplestat60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/people-park-path.mp4") {
    return `${creation.mediaUrl}?v=20261003peoplepark60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/people-bookstore.mp4") {
    return `${creation.mediaUrl}?v=20261003peoplebook60`;
  }
  return creation.mediaUrl;
}

/** App-oriented plate payload (canonical names + current API aliases). */
export function plateAppFields(creation: Creation & { author?: { handle: string; displayName: string; avatarUrl: string } | null }) {
  const notes = [...creation.steps]
    .sort((a, b) => a.position - b.position)
    .map((s) => ({
      id: s.id,
      position: s.position,
      prompt: s.prompt,
      model: s.model,
      text: s.note || "",
      // current API name on the step object:
      note: s.note || "",
    }))
    .filter((n) => n.text || n.prompt);
  return {
    id: creation.id,
    imageURL: appMediaUrl(creation),
    poster: curatedPoster(creation),
    prompt: cleanDisplayPrompt(creation.prompt),
    model: creation.model,
    modelVersion: creation.modelVersion || "",
    displayModel: displayModel(creation),
    notes,
    creatorHandle: creation.author?.handle || "",
    visibility: creation.visibility,
    createdAt: creation.createdAt,
    // current API field names (kept for existing clients)
    mediaUrl: appMediaUrl(creation),
    userId: creation.userId,
    title: creation.title,
    tags: creation.tags,
    mediaKind: creation.mediaKind,
    steps: creation.steps,
    author: creation.author || null,
  };
}

function json(data: unknown, status = 200, headers?: Record<string, string>) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("content-type", "application/json; charset=utf-8");
  if (!responseHeaders.has("cache-control")) {
    responseHeaders.set("cache-control", "no-store");
  }
  return new Response(JSON.stringify(data), { status, headers: responseHeaders });
}

export async function handleApi(request: Request, store: Store, env: AuthEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const parts = path.split("/").filter(Boolean);

  if (parts[0] !== "api") return json({ error: "Not found" }, 404);
  await store.ready();

  if (request.method === "GET" && path === "/api/health") {
    return json({
      ok: true,
      store: store.kind,
      media: store.mediaKind,
      models: MODELS,
      games: { identity: true, aiNameFilter: !!(env as any).AI },
    });
  }

  if (request.method === "GET" && parts[1] === "media" && parts[2]) {
    const file = await store.getMedia(parts[2]);
    if (!file) return json({ error: "Media not found" }, 404);
    // Stored media: only serve known image types, never as a document or script.
    const SAFE_TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
    const stored = String(file.contentType || "").toLowerCase().split(";")[0].trim();
    const ext = (parts[2].split(".").pop() || "").toLowerCase();
    const safeType = Object.values(SAFE_TYPES).includes(stored) ? stored : SAFE_TYPES[ext] || "";
    return new Response(file.bytes, {
      headers: {
        "content-type": safeType || "application/octet-stream",
        "content-disposition": safeType ? "inline" : "attachment",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  }

  if (request.method === "GET" && path === "/api/feed") {
    const q = url.searchParams.get("q") || "";
    const kindParam = (url.searchParams.get("kind") || "").toLowerCase();
    const limit = Math.min(120, Math.max(1, Number(url.searchParams.get("limit") || 40) || 40));
    const fields = (url.searchParams.get("fields") || "").toLowerCase();
    const pageRaw = Number(url.searchParams.get("page") || 0);
    const offsetParam = url.searchParams.get("offset");
    const offset = offsetParam != null && offsetParam !== ""
      ? Math.max(0, Number(offsetParam) || 0)
      : pageRaw > 1
        ? (Math.floor(pageRaw) - 1) * limit
        : 0;
    const mediaKind = kindParam === "video" ? "video" : kindParam === "image" ? "image" : q.trim() ? "all" : "image";
    const page = Math.floor(offset / limit) + 1;
    try {
      const { items, total } = await store.listFeed({
        q,
        model: url.searchParams.get("model") || "",
        tag: url.searchParams.get("tag") || "",
        following: url.searchParams.get("following") === "1",
        limit,
        offset,
        viewerId: undefined,
        mediaKind,
      });
      const withAuthors = await attachAuthors(store, items);
      const creations = fields === "card" ? withAuthors.map(toCardFields) : withAuthors;
      const headers: Record<string, string> = {};
      if (url.searchParams.get("following") !== "1" && !q.trim()) {
        headers["cache-control"] = "public, max-age=60, stale-while-revalidate=300";
      }
      return json({ creations, total, limit, offset, page }, 200, headers);
    } catch {
      // Search must never 500 for ordinary queries — empty wall beats a Worker exception.
      return json({ creations: [], total: 0, limit, offset, page });
    }
  }

  if (request.method === "GET" && path === "/api/catalog") {
    // The whole public gallery as compact cards, in one cacheable response.
    // The front end loads this once and filters, searches and indexes it in the browser.
    try {
      const plates: Array<ReturnType<typeof toCardFields> & { featured: boolean; createdAt: string }> = [];
      for (const mediaKind of ["image", "video"] as const) {
        for (let offset = 0; offset < 6000; offset += 120) {
          const { items, total } = await store.listFeed({
            q: "", model: "", tag: "", following: false, limit: 120, offset, viewerId: undefined, mediaKind,
          });
          for (const card of await attachAuthors(store, items)) {
            plates.push({ ...toCardFields(card), featured: Boolean(card.featured), createdAt: card.createdAt });
          }
          if (!items.length || offset + 120 >= total) break;
        }
      }
      return json({ plates, total: plates.length }, 200, {
        "cache-control": "public, max-age=300, stale-while-revalidate=3600",
      });
    } catch {
      return json({ plates: [], total: 0 });
    }
  }

  if (request.method === "GET" && path === "/api/creators") {
    try {
      return json({ creators: await store.listCreators(url.searchParams.get("q") || "") });
    } catch {
      return json({ creators: [] });
    }
  }

  if (request.method === "GET" && parts[1] === "users" && parts[2] && !parts[3]) {
    const profile = await store.publicUser(parts[2].toLowerCase(), undefined);
    if (!profile) return json({ error: "No creator with that handle." }, 404);
    const creations = await attachAuthors(store, await store.listByUser(profile.id, undefined, false));
    return json({ profile, creations });
  }

  if (request.method === "GET" && parts[1] === "creations" && parts[2] && !parts[3]) {
    const creation = await store.getCreation(parts[2], undefined);
    if (!creation || creation.hidden) return json({ error: "That creation is not available." }, 404);
    const [card] = await attachAuthors(store, [creation]);
    return json({ creation: card });
  }

  return json({ error: "Not found" }, 404);
}

function toCardFields(card: Creation & {
  author?: { handle: string; displayName: string; avatarUrl: string } | null;
  imageURL?: string;
  poster?: string;
}) {
  const mediaUrl = appMediaUrl(card);
  const poster = curatedPoster(card);
  const preview = card.mediaKind === "video" ? poster || mediaUrl : mediaUrl;
  return {
    id: card.id,
    title: card.title,
    prompt: cleanDisplayPrompt(card.prompt),
    model: card.model,
    modelVersion: card.modelVersion || "",
    displayModel: displayModel(card),
    tags: card.tags,
    mediaUrl,
    mediaKind: card.mediaKind,
    imageURL: mediaUrl,
    poster,
    thumbUrl: gridThumbUrl(preview),
  };
}

async function attachAuthors(store: Store, items: Creation[]) {
  const cache = new Map<string, Awaited<ReturnType<Store["getUserById"]>>>();
  const ids = [...new Set(items.map((item) => item.userId))];
  await Promise.all(
    ids.map(async (id) => {
      cache.set(id, await store.getUserById(id));
    }),
  );
  return items.map((item) => {
    const author = cache.get(item.userId);
    const card = {
      ...item,
      author: author ? { handle: author.handle, displayName: author.displayName, avatarUrl: author.avatarUrl } : null,
    };
    return {
      ...card,
      prompt: cleanDisplayPrompt(card.prompt),
      modelVersion: card.modelVersion || "",
      displayModel: displayModel(card),
      imageURL: appMediaUrl(card),
      poster: curatedPoster(card),
      thumbUrl: gridThumbUrl(card.mediaKind === "video" ? curatedPoster(card) || appMediaUrl(card) : appMediaUrl(card)),
      creatorHandle: card.author?.handle || "",
      notes: [...card.steps]
        .sort((a, b) => a.position - b.position)
        .map((s) => ({ id: s.id, position: s.position, prompt: s.prompt, model: s.model, text: s.note || "", note: s.note || "" })),
      plate: plateAppFields(card),
    };
  });
}

function clip(value: string, max: number) {
  return value.trim().slice(0, max);
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const data = await request.json();
    return data && typeof data === "object" ? data as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

