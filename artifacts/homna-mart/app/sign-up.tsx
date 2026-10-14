import { useAuth, useSignUp } from "@clerk/expo";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export default function SignUpScreen() {
  const colors = useColors();
  const styles = makeStyles(colors);
  const { signUp, fetchStatus } = useSignUp();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const [errorText, setErrorText] = useState("");
  const loading = fetchStatus === "fetching";

  useEffect(() => {
    if (isSignedIn) router.replace("/account" as Href);
  }, [isSignedIn, router]);

  const finalize = async () => {
    await signUp.finalize({
      navigate: ({ session, decorateUrl }) => {
        if (session?.currentTask) {
          setErrorText("আপনার অ্যাকাউন্টের নিরাপত্তা যাচাই সম্পন্ন করুন।");
          return;
        }
        const url = decorateUrl("/account");
        if (Platform.OS === "web" && /^https?:\/\//.test(url)) window.location.assign(url);
        else router.replace(url as Href);
      },
    });
  };

  const submit = async () => {
    setErrorText("");
    if (!email.trim() || !password) {
      setErrorText("ইমেইল ও পাসওয়ার্ড লিখুন।");
      return;
    }
    const result = await signUp.password({ emailAddress: email.trim(), password });
    if (result.error) {
      setErrorText("অ্যাকাউন্ট তৈরি করা যায়নি। তথ্য যাচাই করে আবার চেষ্টা করুন।");
      return;
    }
    const verification = await signUp.verifications.sendEmailCode();
    if (verification.error) {
      setErrorText("ইমেইলে যাচাই কোড পাঠানো যায়নি। Clerk email verification সেটিংস দেখুন।");
      return;
    }
    setVerificationSent(true);
  };

  const verify = async () => {
    setErrorText("");
    const result = await signUp.verifications.verifyEmailCode({ code: code.trim() });
    if (result.error) {
      setErrorText("যাচাই কোডটি সঠিক নয়। আবার চেষ্টা করুন।");
      return;
    }
    if (signUp.status === "complete") await finalize();
    else setErrorText("ইমেইল যাচাই সম্পন্ন হয়নি। আবার কোড পাঠান।");
  };

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.brand}>Homna Mart</Text>
        <Text style={styles.title}>{verificationSent ? "ইমেইল যাচাই" : "নতুন অ্যাকাউন্ট"}</Text>
        <Text style={styles.subtitle}>
          {verificationSent ? `${email.trim()} ঠিকানায় পাঠানো কোড লিখুন।` : "ইমেইল যাচাই করে আপনার গ্রাহক অ্যাকাউন্ট তৈরি করুন।"}
        </Text>
        {!verificationSent ? (
          <>
            <Text style={styles.label}>ইমেইল</Text>
            <TextInput
              accessibilityLabel="ইমেইল"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="name@example.com"
              placeholderTextColor={colors.mutedForeground}
              style={styles.input}
            />
            <Text style={styles.label}>পাসওয়ার্ড</Text>
            <TextInput
              accessibilityLabel="পাসওয়ার্ড"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="কমপক্ষে ৮ অক্ষর"
              placeholderTextColor={colors.mutedForeground}
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              disabled={loading || !email.trim() || !password}
              onPress={() => void submit()}
              style={[styles.button, (loading || !email.trim() || !password) && styles.disabled]}
            >
              {loading ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.buttonText}>অ্যাকাউন্ট তৈরি করুন</Text>}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.label}>যাচাই কোড</Text>
            <TextInput
              accessibilityLabel="যাচাই কোড"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              placeholder="ইমেইলে পাওয়া কোড"
              placeholderTextColor={colors.mutedForeground}
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              disabled={loading || code.trim().length < 4}
              onPress={() => void verify()}
              style={[styles.button, (loading || code.trim().length < 4) && styles.disabled]}
            >
              {loading ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.buttonText}>ইমেইল যাচাই করুন</Text>}
            </Pressable>
            <Pressable onPress={() => void signUp.verifications.sendEmailCode()} style={styles.linkButton}>
              <Text style={styles.link}>নতুন কোড পাঠান</Text>
            </Pressable>
          </>
        )}
        {errorText ? <Text accessibilityRole="alert" style={styles.error}>{errorText}</Text> : null}
        {!verificationSent && (
          <Pressable onPress={() => router.push("/sign-in" as Href)} style={styles.linkButton}>
            <Text style={styles.link}>আগে থেকেই অ্যাকাউন্ট আছে? সাইন ইন</Text>
          </Pressable>
        )}
        <Pressable onPress={() => router.replace("/" as Href)} style={styles.backButton}>
          <Text style={styles.backText}>বাজারে ফিরে যান</Text>
        </Pressable>
        <View nativeID="clerk-captcha" />
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    screen: { flexGrow: 1, justifyContent: "center", padding: 20, backgroundColor: colors.background },
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
    subtitle: { color: colors.mutedForeground, fontSize: 13, lineHeight: 20, marginTop: 7, marginBottom: 12 },
    label: { color: colors.foreground, fontSize: 13, fontWeight: "700", marginTop: 14, marginBottom: 7 },
    input: {
      minHeight: 48,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 13,
      color: colors.foreground,
      backgroundColor: colors.background,
    },
    button: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 20, borderRadius: 12, backgroundColor: colors.primary },
    buttonText: { color: colors.primaryForeground, fontSize: 14, fontWeight: "800" },
    disabled: { opacity: 0.5 },
    error: { color: colors.destructive, fontSize: 12, lineHeight: 18, marginTop: 12 },
    linkButton: { alignItems: "center", marginTop: 14, padding: 6 },
    link: { color: colors.primary, fontSize: 13, fontWeight: "700" },
    backButton: { alignItems: "center", marginTop: 16, padding: 6 },
    backText: { color: colors.mutedForeground, fontSize: 12 },
  });
}
