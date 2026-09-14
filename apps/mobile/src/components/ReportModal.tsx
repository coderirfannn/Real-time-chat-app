import React, { memo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Icon } from './ui/Icon';
import { reportApi } from '../services/api/report.api';
import type { ReportReason, ReportTargetType } from '@chatlock/shared-types';

export interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  reportedUserName?: string;
  conversationId?: string;
  messageId?: string;
  onSuccess?: () => void;
}

const REPORT_REASONS: Array<{ key: ReportReason; label: string; desc: string }> = [
  {
    key: 'HARASSMENT',
    label: 'Harassment & Bullying',
    desc: 'Targeted attacks, threats, or intimidation',
  },
  {
    key: 'SPAM',
    label: 'Spam & Commercial',
    desc: 'Unsolicited mass messages or scam links',
  },
  {
    key: 'HATE_SPEECH',
    label: 'Hate Speech',
    desc: 'Attacks on identity, racism, or discrimination',
  },
  {
    key: 'INAPPROPRIATE_CONTENT',
    label: 'Inappropriate Content',
    desc: 'Nudity, sexual violence, or graphic harm',
  },
  {
    key: 'IMPERSONATION',
    label: 'Impersonation',
    desc: 'Pretending to be someone else or deceptive identity',
  },
  {
    key: 'OTHER',
    label: 'Other Issue',
    desc: 'Any other safety or community guideline violation',
  },
];

export const ReportModal = memo(function ReportModal({
  visible,
  onClose,
  targetType,
  targetId,
  reportedUserName,
  conversationId,
  messageId,
  onSuccess,
}: ReportModalProps): React.JSX.Element {
  const [selectedReason, setSelectedReason] = useState<ReportReason>('HARASSMENT');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleReset = useCallback(() => {
    setSelectedReason('HARASSMENT');
    setDescription('');
    setErrorMessage(null);
    setIsSubmitted(false);
    setIsSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!selectedReason) {
      setErrorMessage('Please select a reason for reporting.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await reportApi.submitReport({
        targetType,
        targetId,
        conversationId,
        messageId,
        reason: selectedReason,
        description: description.trim() || undefined,
      });

      setIsSubmitted(true);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to submit report. Please check your connection and try again.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [targetType, targetId, conversationId, messageId, selectedReason, description, onSuccess]);

  const targetTitle =
    targetType === 'USER'
      ? `Report User${reportedUserName ? ` (@${reportedUserName})` : ''}`
      : targetType === 'MESSAGE'
        ? 'Report Message'
        : 'Report Conversation';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <TouchableOpacity style={styles.backdropTouchable} activeOpacity={1} onPress={handleClose}>
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            {isSubmitted ? (
              <View style={styles.successContainer}>
                <View style={styles.successIconCircle}>
                  <Icon name="check" size={32} color="#10B981" />
                </View>
                <Text style={styles.successTitle}>Report Submitted</Text>
                <Text style={styles.successSubtitle}>
                  Thank you for helping keep ChatLock safe. Our moderation team will review this
                  report and take appropriate action. Your identity remains strictly confidential.
                </Text>
                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={handleClose}
                  activeOpacity={0.8}
                >
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.formContainer}>
                {/* Modal Header */}
                <View style={styles.header}>
                  <View style={styles.headerIconCircle}>
                    <Icon name="alert-circle" size={18} color="#EF4444" />
                  </View>
                  <View style={styles.headerText}>
                    <Text style={styles.headerTitle}>{targetTitle}</Text>
                    <Text style={styles.headerSubtitle}>
                      Reports are confidential and reviewed by moderators
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleClose}
                    style={styles.closeIconBtn}
                    activeOpacity={0.7}
                  >
                    <Icon name="x" size={18} color="#A0A5B5" />
                  </TouchableOpacity>
                </View>

                {/* Privacy Guarantee Banner */}
                <View style={styles.privacyBanner}>
                  <Icon name="shield" size={14} color="#0066FF" />
                  <Text style={styles.privacyBannerText}>
                    Your report is private. The reported user will not know who reported them.
                  </Text>
                </View>

                {errorMessage ? (
                  <View style={styles.errorBanner}>
                    <Icon name="alert-circle" size={14} color="#EF4444" />
                    <Text style={styles.errorBannerText}>{errorMessage}</Text>
                  </View>
                ) : null}

                <ScrollView
                  style={styles.scrollArea}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.sectionLabel}>Select Reason</Text>
                  <View style={styles.reasonsList}>
                    {REPORT_REASONS.map((r) => {
                      const isSelected = selectedReason === r.key;
                      return (
                        <TouchableOpacity
                          key={r.key}
                          style={[styles.reasonOption, isSelected && styles.reasonOptionSelected]}
                          onPress={() => setSelectedReason(r.key)}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}
                          >
                            {isSelected && <View style={styles.radioInner} />}
                          </View>
                          <View style={styles.reasonTextContainer}>
                            <Text
                              style={[styles.reasonLabel, isSelected && styles.reasonLabelSelected]}
                            >
                              {r.label}
                            </Text>
                            <Text style={styles.reasonDesc}>{r.desc}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={[styles.sectionLabel, { marginTop: 16 }]}>
                    Additional Details (Optional)
                  </Text>
                  <TextInput
                    style={styles.textArea}
                    placeholder="Provide any additional context that will help us investigate this issue..."
                    placeholderTextColor="#6B7280"
                    multiline
                    numberOfLines={3}
                    maxLength={1000}
                    value={description}
                    onChangeText={setDescription}
                  />
                  <Text style={styles.charCount}>{description.length} / 1000 characters</Text>
                </ScrollView>

                {/* Actions */}
                <View style={styles.footerActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={handleClose}
                    disabled={isSubmitting}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                    activeOpacity={0.8}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Icon name="alert-circle" size={16} color="#FFFFFF" />
                        <Text style={styles.submitBtnText}>Submit Report</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropTouchable: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: '#1E2028',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2E323D',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
      },
    }),
  },
  formContainer: {
    padding: 20,
    maxHeight: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F3F4F6',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  closeIconBtn: {
    padding: 6,
    borderRadius: 8,
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 102, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 12,
  },
  privacyBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#60A5FA',
    lineHeight: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#F87171',
  },
  scrollArea: {
    maxHeight: 320,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D1D5DB',
    marginBottom: 8,
  },
  reasonsList: {
    gap: 8,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#252932',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2E323D',
    gap: 12,
  },
  reasonOptionSelected: {
    backgroundColor: 'rgba(0, 102, 255, 0.12)',
    borderColor: '#0066FF',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#6B7280',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  radioCircleSelected: {
    borderColor: '#0066FF',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0066FF',
  },
  reasonTextContainer: {
    flex: 1,
  },
  reasonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F3F4F6',
  },
  reasonLabelSelected: {
    color: '#60A5FA',
  },
  reasonDesc: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  textArea: {
    backgroundColor: '#252932',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2E323D',
    color: '#F3F4F6',
    padding: 12,
    fontSize: 13,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'right',
    marginTop: 4,
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 16,
    gap: 10,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    gap: 6,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  successContainer: {
    padding: 32,
    alignItems: 'center',
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F3F4F6',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  doneButton: {
    backgroundColor: '#0066FF',
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 8,
  },
  doneButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
