import React from "react";
import { Pressable, Text, View } from "react-native";
import { GOLD } from "../constants/colors";

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

// Top-level error boundary so a JS render error shows a recoverable fallback
// instead of a blank white screen. Tapping "Try again" remounts the subtree.
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surfaces in dev; wire this to a crash reporter (e.g. Sentry) when added.
    console.error("Uncaught error:", error, info.componentStack);
  }

  handleReset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View
        className="flex-1 items-center justify-center px-8"
        style={{ backgroundColor: "#090A07" }}
      >
        <Text className="mb-3 text-xl font-semibold" style={{ color: GOLD }}>
          Something went wrong
        </Text>
        <Text className="mb-8 text-center text-base text-white/70">
          An unexpected error occurred. Please try again.
        </Text>
        <Pressable
          onPress={this.handleReset}
          className="rounded-full px-8 py-3"
          style={{ backgroundColor: GOLD }}
        >
          <Text className="text-base font-semibold text-black">Try again</Text>
        </Pressable>
      </View>
    );
  }
}
