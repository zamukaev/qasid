import { useCallback, useEffect, useState } from "react";
import { ImageSourcePropType } from "react-native";
import { invalidateStorageUrl } from "../services/storage";
import { useReciterImageSource } from "./useReciterImageSource";

export interface ImageLoadState {
  source: ImageSourcePropType;
  showSkeleton: boolean;
  onLoad: () => void;
  onError: () => void;
}

export const useImageLoadState = (imagePath?: string): ImageLoadState => {
  const { source, isRemote, isResolving } = useReciterImageSource(imagePath);
  const [hasLoaded, setHasLoaded] = useState(false);

  // A new imagePath means a new (or recycled) card — stale "loaded" state must
  // not suppress the skeleton for whatever image is about to load next.
  useEffect(() => {
    setHasLoaded(false);
  }, [imagePath]);

  // Stable identities so consumers can memoize the element that renders the
  // image without it remounting (and flickering) on every parent render.
  const onLoad = useCallback(() => setHasLoaded(true), []);

  const onError = useCallback(() => {
    // A cached download URL that no longer loads (object replaced, token
    // revoked) is dropped so the next resolution goes back to the network.
    // invalidateStorageUrl is capped at once per path per session, so an
    // offline burst of errors cannot wipe the cache.
    invalidateStorageUrl(imagePath);
    setHasLoaded(true);
  }, [imagePath]);

  return {
    source,
    showSkeleton: isResolving || (isRemote && !hasLoaded),
    onLoad,
    onError,
  };
};
