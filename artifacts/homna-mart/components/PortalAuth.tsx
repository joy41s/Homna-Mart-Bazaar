import { useSignIn } from "@clerk/expo";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useColors } from "@/hooks/useColors";

type PortalKind = "customer" | "admin" | "merchant";

const normalizeIdentifier = (value: string) => {
  const trimmed = value.trim();
  if (/^01\d{9}$/.test(trimmed)) return `+88${trimmed}`;
  if (/^8801\d{9}$/.test(trimmed)) return `+${trimmed}`;
  return trimmed;
};

export function PortalAuth({
  kind,
  redirectTo,
}: {
  kind: PortalKind;
  redirectTo: string;
}) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const { signIn, fetchStatus } = useSignIn();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needsEmailCode, setNeedsEmailCode] = useState(false);
  const [message, setMessage] = useState("");
  const loading = fetchStatus === "fetching";
  const title = kind === "admin" ? "প্রশাসক লগইন" : kind === "merchant" ? "মার্চেন্ট লগইন" : "সাইন ইন";

  const finalize = async () => {
    await signIn.finalize({
      navigate: ({ session, decorateUrl }) => {
        if (session?.currentTask) {
          setMessage("আপনার অ্যাকাউন্টের নিরাপত্তা যাচাই সম্পন্ন করুন।");
          return;
        }
        const nextUrl = decorateUrl(redirectTo);
        if (Platform.OS === "web" && /^https?:\/\//.test(nextUrl)) {
          window.location.assign(nextUrl);
        } else {
          router.replace(nextUrl as Href);
        }
      },
    });
  };

  const submit = async () => {
    setMessage("");
    const normalized = normalizeIdentifier(identifier);
    if (!normalized || !password) {
      setMessage("ইমেইল/ফোন ও পাসওয়ার্ড লিখুন।");
      return;
    }
    const { error } = await signIn.password({ identifier: normalized, password });
    if (error) {
      setMessage("লগইন করা যায়নি। তথ্য যাচাই করে আবার চেষ্টা করুন।");
      return;
    }
    if (signIn.status === "complete") {
      await finalize();
      return;
    }
    if (signIn.status === "needs_client_trust" || signIn.status === "needs_second_factor") {
      const hasEmailFactor = signIn.supportedSecondFactors.some((factor) => factor.strategy === "email_code");
      if (!hasEmailFactor) {
        setMessage("এই অ্যাকাউন্টে চালু থাকা নিরাপত্তা যাচাই এই স্ক্রিনে সমর্থিত নয়। Clerk-এ ইমেইল কোড যাচাই চালু করুন।");
        return;
      }
      const result = await signIn.mfa.sendEmailCode();
      if (result.error) {
        setMessage("যাচাই কোড পাঠানো যায়নি। পরে আবার চেষ্টা করুন।");
        return;
      }
      setNeedsEmailCode(true);
      return;
    }
    setMessage("লগইন সম্পন্ন হয়নি। Clerk অ্যাকাউন্টের সাইন-ইন পদ্ধতি যাচাই করুন।");
  };

  const verifyCode = async () => {
    setMessage("");
    const result = await signIn.mfa.verifyEmailCode({ code: code.trim() });
    if (result.error) {
      setMessage("যাচাই কোডটি সঠিক নয়। আবার চেষ্টা করুন।");
      return;
    }
    if (signIn.status === "complete") {
      await finalize();
      return;
    }
    setMessage("নিরাপত্তা যাচাই সম্পন্ন হয়নি। আবার কোড পাঠান।");
  };

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.brand}>Homna Mart</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          {kind === "admin"
            ? "শুধু অনুমোদিত প্রশাসক অ্যাকাউন্টে প্রবেশ করতে পারবেন।"
            : kind === "merchant"
              ? "আপনার যাচাইকৃত ইমেইল দোকানের জন্য অনুমোদিত হতে হবে।"
              : "আপনার ইমেইল বা Clerk-এ চালু থাকা ফোন নম্বর দিয়ে প্রবেশ করুন।"}
        </Text>

        {needsEmailCode ? (
          <>
            <Text style={styles.label}>ইমেইলে পাঠানো যাচাই কোড</Text>
            <TextInput
              accessibilityLabel="যাচাই কোড"
              value={code}
              onChangeText={setCode}
              placeholder="৬ সংখ্যার কোড"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              disabled={loading || code.trim().length < 4}
              onPress={() => void verifyCode()}
              style={[styles.button, (loading || code.trim().length < 4) && styles.disabled]}
            >
              {loading ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.buttonText}>যাচাই করুন</Text>}
            </Pressable>
            <Pressable onPress={() => void signIn.mfa.sendEmailCode()} style={styles.linkButton}>
              <Text style={styles.link}>নতুন কোড পাঠান</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.label}>ইমেইল বা ফোন নম্বর</Text>
            <TextInput
              accessibilityLabel="ইমেইল বা ফোন নম্বর"
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="ইমেইল অথবা +8801XXXXXXXXX"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={styles.input}
            />
            <Text style={styles.hint}>ফোন নম্বর দিয়ে লগইন করতে হলে Clerk-এ Phone number ও password চালু থাকতে হবে।</Text>
            <Text style={styles.label}>পাসওয়ার্ড</Text>
            <TextInput
              accessibilityLabel="পাসওয়ার্ড"
              value={password}
              onChangeText={setPassword}
              placeholder="আপনার পাসওয়ার্ড"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              disabled={loading || !identifier.trim() || !password}
              onPress={() => void submit()}
              style={[styles.button, (loading || !identifier.trim() || !password) && styles.disabled]}
            >
              {loading ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.buttonText}>লগইন</Text>}
            </Pressable>
            {kind === "customer" && (
              <Pressable onPress={() => router.push("/sign-up" as Href)} style={styles.linkButton}>
                <Text style={styles.link}>নতুন অ্যাকাউন্ট তৈরি করুন</Text>
              </Pressable>
            )}
          </>
        )}

        {message ? <Text accessibilityRole="alert" style={styles.error}>{message}</Text> : null}
        <Pressable onPress={() => router.replace("/" as Href)} style={styles.backButton}>
          <Text style={styles.backText}>বাজারে ফিরে যান</Text>
        </Pressable>
        {kind === "customer" ? null : <View nativeID="clerk-captcha" />}
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    screen: {
      flexGrow: 1,
      justifyContent: "center",
      padding: 20,
      backgroundColor: colors.background,
    },
    card: {
      width: "100%",
      maxWidth: 460,
      alignSelf: "center",
      padding: 24,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    brand: { color: colors.primary, fontSize: 16, fontWeight: "800", marginBottom: 12 },
    title: { color: colors.foreground, fontSize: 26, fontWeight: "800" },
    subtitle: { color: colors.mutedForeground, fontSize: 13, lineHeight: 20, marginTop: 7, marginBottom: 14 },
    label: { color: colors.foreground, fontSize: 13, fontWeight: "700", marginTop: 14, marginBottom: 7 },
    hint: { color: colors.mutedForeground, fontSize: 11, lineHeight: 16, marginTop: 6 },
    input: {
      minHeight: 48,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 13,
      color: colors.foreground,
      backgroundColor: colors.background,
    },
    button: {
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 20,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    buttonText: { color: colors.primaryForeground, fontSize: 14, fontWeight: "800" },
    disabled: { opacity: 0.5 },
    error: { color: colors.destructive, fontSize: 12, lineHeight: 18, marginTop: 12 },
    linkButton: { alignItems: "center", marginTop: 15, padding: 6 },
    link: { color: colors.primary, fontSize: 13, fontWeight: "700" },
    backButton: { alignItems: "center", marginTop: 20, padding: 6 },
    backText: { color: colors.mutedForeground, fontSize: 12 },
  });
}
