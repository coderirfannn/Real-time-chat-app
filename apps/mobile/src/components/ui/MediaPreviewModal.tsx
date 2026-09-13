import React, { memo, useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Platform,
  SafeAreaView,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { Icon } from './Icon';
import { resolveMediaUrl } from '../../utils/media-url';
import type { MessageAttachment } from '@chatlock/shared-types';

export interface MediaPreviewModalProps {
  visible: boolean;
  attachment?: MessageAttachment | null;
  onClose: () => void;
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const MediaPreviewModal = memo(function MediaPreviewModal({
  visible,
  attachment,
  onClose,
}: MediaPreviewModalProps): React.JSX.Element | null {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const resolvedUrl = attachment?.url ? resolveMediaUrl(attachment.url) : '';

  useEffect(() => {
    if (visible) {
      setIsLoading(true);
      setHasError(false);
    }
  }, [visible, resolvedUrl]);

  const handleLoadEnd = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  if (!visible && !attachment) {
    return null;
  }

  const fileName = attachment?.name || 'Photo';
  const sizeText = formatFileSize(attachment?.size);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      accessibilityViewIsModal
      accessibilityLabel="Media Viewer"
    >
      <StatusBar barStyle="light-content" backgroundColor="rgba(11, 14, 20, 0.98)" />
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header Bar */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close image preview"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Icon name="x" size={22} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>

            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {fileName}
              </Text>
              {Boolean(sizeText) && <Text style={styles.headerSubtitle}>{sizeText}</Text>}
            </View>

            {/* Balancer spacer to keep title nicely centered */}
            <View style={styles.headerSpacer} />
          </View>

          {/* Centered Media Content View */}
          <View style={styles.contentContainer}>
            {isLoading && !hasError && (
              <View style={styles.centerOverlay}>
                <ActivityIndicator size="large" color="#246BFD" />
                <Text style={styles.loadingText}>Loading image...</Text>
              </View>
            )}

            {hasError ? (
              <View style={styles.centerOverlay}>
                <Icon name="alert-circle" size={48} color="#F75555" strokeWidth={2} />
                <Text style={styles.errorTitle}>Failed to load image</Text>
                <Text style={styles.errorSubtitle}>
                  The image could not be retrieved from the server.
                </Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => {
                    setHasError(false);
                    setIsLoading(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading image"
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                maximumZoomScale={3}
                minimumZoomScale={1}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                centerContent
              >
                {Boolean(resolvedUrl) && (
                  <Image
                    source={{ uri: resolvedUrl }}
                    style={{
                      width: screenWidth,
                      height: screenHeight * 0.78,
                    }}
                    resizeMode="contain"
                    onLoadEnd={handleLoadEnd}
                    onError={handleError}
                    accessibilityLabel={fileName}
                  />
                )}
              </ScrollView>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 14, 20, 0.96)',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(11, 14, 20, 0.75)',
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginHorizontal: 12,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 5,
  },
  loadingText: {
    color: '#A0A5B5',
    fontSize: 14,
    marginTop: 12,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  errorSubtitle: {
    color: '#A0A5B5',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    maxWidth: 280,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#246BFD',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
