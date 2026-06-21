import {setGlobalOptions} from "firebase-functions";
import "./lib/firebase"; // ensures Admin SDK is initialized

setGlobalOptions({maxInstances: 10});

// Search HTTP endpoints
export {searchReciters} from "./search/reciters";
export {searchSurahs} from "./search/surahs";

// Playback aggregation triggers
export {onArtistPlaybackCreated} from "./playback/artist";
export {onReciterPlaybackCreated} from "./playback/reciter";

// Favorites aggregation
export {onFavoriteWritten} from "./favorites/aggregate";

// Recommendation system
export {dailyRecommendationJob} from "./recommendations/playlists";
export {generateWeeklyMix} from "./recommendations/weeklyMix";
