import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  Animated,
  Modal,
  StyleSheet,
  Platform,
} from "react-native";
import { AntDesign } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TOAST_CONFIG } from "./config";

export type ToastType = "error" | "success" | "warning" | "info";

interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

export default function ErrorAlert({
  visible,
  message,
  type = "error",
  duration = 3000,
  onClose,
}: ToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-200)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const config = TOAST_CONFIG[type];

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      translateY.setValue(-200);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -200,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={hideToast}
      statusBarTranslucent
    >
      <Animated.View
        style={[
          styles.container,
          {
            top: insets.top + 40,
            transform: [{ translateY }],
            opacity: opacityAnim,
          },
        ]}
      >
        <Pressable
          onPress={hideToast}
          style={[
            styles.toast,
            {
              backgroundColor: config.bgColor,
              borderColor: config.borderColor,
            },
          ]}
        >
          <View
            style={[styles.accentBar, { backgroundColor: config.accentColor }]}
          />

          <View style={styles.content}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: `${config.accentColor}25` },
              ]}
            >
              <AntDesign
                name={config.icon as any}
                size={24}
                color={config.iconColor}
              />
            </View>

            <Text style={styles.message} numberOfLines={3}>
              {message}
            </Text>

            <Pressable
              onPress={hideToast}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <AntDesign name="close" size={18} color="#E7C11C" />
            </Pressable>
          </View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: "center",
  },
  toast: {
    width: "100%",
    maxWidth: 500,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  accentBar: {
    position: "absolute",
    top: 10,
    left: 0,
    right: 0,
    height: 3,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingTop: 19,
    backgroundColor: "#1c1c1c",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  message: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    color: "#ffffff",
    fontWeight: "500",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
    backgroundColor: "rgba(231, 193, 28, 0.1)",
  },
});
