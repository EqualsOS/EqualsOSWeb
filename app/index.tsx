import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Linking,
  BackHandler,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebView as WebViewType } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import type {
  WebViewMessageEvent,
  ShouldStartLoadRequest,
  WebViewNavigation,
} from 'react-native-webview/lib/WebViewTypes';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';

const MY_WEBSITE_URL = 'https://equalsos.com';
const APP_BACKGROUND_COLOR = '#1D3D47'; // Default color

// --- Helper (Unchanged) ---
function getIconStyleForColor(hexColor: string): 'light' | 'dark' {
  if (!hexColor) return 'light';

  try {
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? 'dark' : 'light';
  } catch (e) {
    return 'light';
  }
}

// --- Injected JavaScript (Unchanged) ---
const injectedJavaScript = `
  (() => {
    // Function to send color and attach attribute observer
    const setupThemeObserver = (metaTag) => {
      const sendColor = (color) => {
        if (color) {
          window.ReactNativeWebView.postMessage(color);
        }
      };

      // 1. Send the current color
      sendColor(metaTag.getAttribute('content'));

      // 2. Create an observer for attribute changes (like theme swaps)
      const attributeObserver = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'content') {
            sendColor(mutation.target.getAttribute('content'));
          }
        }
      });

      // 3. Start observing the meta tag for content changes
      attributeObserver.observe(metaTag, { attributes: true });
    };

    // --- Main Logic ---
    
    // 1. Try to find the tag immediately on script injection
    const initialTag = document.querySelector('meta[name="theme-color"]');
    if (initialTag) {
      setupThemeObserver(initialTag);
    }

    // 2. Set up an observer for the <head> in case the tag is added later (common in SPAs)
    const headObserver = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        for (const node of mutation.addedNodes) {
          // Check if the added node is our meta tag
          if (node.nodeType === Node.ELEMENT_NODE && node.matches('meta[name="theme-color"]')) {
            setupThemeObserver(node);
            // Optional: We found it, no need to keep observing <head>
            // headObserver.disconnect(); 
          }
        }
      }
    });

    // Start observing the <head> for new child elements
    if (document.head) {
      headObserver.observe(document.head, { childList: true });
    }
    
  })();
  true;
`;

// This is now the main, and only, page for the app
export default function Index() {
  const [hasError, setHasError] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const webViewRef = useRef<WebViewType>(null);
  const [themeColor, setThemeColor] = useState(APP_BACKGROUND_COLOR);

  // --- This effect now runs when themeColor changes ---
  useLayoutEffect(() => {
    if (Platform.OS === 'android') {
      // Use the only available function to set the bottom nav bar color
      SystemUI.setBackgroundColorAsync(themeColor);
    }
  }, [themeColor]);

  // --- Back Button Handler (Unchanged) ---
  useEffect(() => {
    const onBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );

    return () => subscription.remove();
  }, [canGoBack]);

  const handleRetry = () => {
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  };

  const handleNavigation = (event: ShouldStartLoadRequest) => {
    const { url } = event;

    if (url.startsWith(MY_WEBSITE_URL) || url === 'about:blank') {
      return true;
    }

    Linking.openURL(url);
    return false;
  };

  // --- Handle messages from the WebView (Unchanged) ---
  const handleMessage = (event: WebViewMessageEvent) => {
    const newColor = event.nativeEvent.data;
    if (newColor && newColor.startsWith('#')) {
      setThemeColor(newColor);
    }
  };

  const iconStyle = getIconStyleForColor(themeColor);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      {/* UPDATED: Container now uses dynamic themeColor */}
      <SafeAreaView style={[styles.container, { backgroundColor: themeColor }]}>
        <StatusBar style={iconStyle} backgroundColor={themeColor} />

        <WebView
          ref={webViewRef}
          source={{ uri: MY_WEBSITE_URL }}
          containerStyle={{ backgroundColor: themeColor }}
          style={[styles.webview, hasError && styles.hidden]}
          // ---
          pullToRefreshEnabled={true}
          onShouldStartLoadWithRequest={handleNavigation}
          onNavigationStateChange={(navState: WebViewNavigation) => {
            setCanGoBack(navState.canGoBack);
          }}
          onLoadStart={() => {
            setHasError(false);
          }}
          onError={() => {
            setHasError(true);
          }}
          // --- Props for theme bridging ---
          injectedJavaScript={injectedJavaScript}
          onMessage={handleMessage}
          // --- NEW PROP ---
          allowsFullscreenVideo={true}
        />

        {/* Error UI */}
        {hasError && (
          // UPDATED: Error container also uses dynamic themeColor
          <View style={[styles.errorContainer, { backgroundColor: themeColor }]}>
            <Text style={styles.errorText}>Failed to load page.</Text>
            <Text style={styles.errorTextSmall}>
              Please check your internet connection.
            </Text>
            <Pressable style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </>
  );
}

// --- Styles ---
// UPDATED: Removed static 'backgroundColor' from styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  hidden: {
    height: 0,
    flex: 0,
    opacity: 0,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E0E0E0',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorTextSmall: {
    fontSize: 14,
    color: '#B0B0B0',
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});