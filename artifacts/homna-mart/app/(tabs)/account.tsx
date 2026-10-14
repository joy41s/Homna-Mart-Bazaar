import { Feather } from "@expo/vector-icons";
import { useAuth, useClerk, useUser } from "@clerk/expo";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

export default function AccountScreen() {
  const colors = useColors();
  const styles = makeStyles(colors);
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const { signOut } = useClerk();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.kicker}>HOMNA MART</Text>
          <Text style={styles.title}>অ্যাকাউন্ট</Text>
          <Text style={styles.subtitle}>আপনার প্রোফাইল ও অর্ডার</Text>
        </View>

        {!isLoaded || !userLoaded ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
        ) : isSignedIn ? (
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Feather name="user" size={24} color={colors.primary} />
            </View>
            <Text style={styles.name}>{user?.fullName || "Homna Mart গ্রাহক"}</Text>
            <Text style={styles.detail}>{user?.primaryEmailAddress?.emailAddress ?? "ইমেইল যোগ করা হয়নি"}</Text>
            {user?.primaryPhoneNumber?.phoneNumber ? (
              <Text style={styles.detail}>{user.primaryPhoneNumber.phoneNumber}</Text>
            ) : null}
            <Pressable onPress={() => router.push("/orders" as Href)} style={styles.action}>
              <Feather name="package" size={18} color={colors.primary} />
              <Text style={styles.actionText}>আমার অর্ডার</Text>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </Pressable>
            <Pressable onPress={() => void signOut()} style={[styles.action, styles.signOutAction]}>
              <Feather name="log-out" size={18} color={colors.destructive} />
              <Text style={[styles.actionText, { color: colors.destructive }]}>সাইন আউট</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Homna Mart-এ স্বাগতম</Text>
            <Text style={styles.detail}>অর্ডার সংরক্ষণ ও অ্যাকাউন্ট ব্যবস্থাপনার জন্য লগইন করুন।</Text>
            <Pressable onPress={() => router.push("/sign-in" as Href)} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>লগইন</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/sign-up" as Href)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>নতুন অ্যাকাউন্ট তৈরি করুন</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.portalSection}>
          <Text style={styles.sectionTitle}>স্টোর পোর্টাল</Text>
          <Text style={styles.detail}>প্রতিটি পোর্টালের প্রবেশাধিকার সার্ভারে যাচাই করা হয়।</Text>
          <Pressable onPress={() => router.push("/merchant" as Href)} style={styles.portalLink}>
            <Text style={styles.portalLinkText}>মার্চেন্ট লগইন</Text>
            <Feather name="arrow-up-right" size={16} color={colors.primary} />
          </Pressable>
          <Pressable onPress={() => router.push("/admin" as Href)} style={styles.portalLink}>
            <Text style={styles.portalLinkText}>প্রশাসক লগইন</Text>
            <Feather name="arrow-up-right" size={16} color={colors.primary} />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { width: "100%", maxWidth: 820, alignSelf: "center", padding: 20, paddingBottom: 34 },
    header: { paddingVertical: 12 },
    kicker: { color: colors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
    title: { color: colors.foreground, fontSize: 28, fontWeight: "800", marginTop: 5 },
    subtitle: { color: colors.mutedForeground, fontSize: 13, marginTop: 5 },
    card: { borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 20, marginTop: 16 },
    avatar: { width: 52, height: 52, borderRadius: 17, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", marginBottom: 12 },
    name: { color: colors.foreground, fontSize: 18, fontWeight: "800" },
    detail: { color: colors.mutedForeground, fontSize: 13, lineHeight: 20, marginTop: 5 },
    cardTitle: { color: colors.foreground, fontSize: 18, fontWeight: "800" },
    action: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderColor: colors.border, marginTop: 15, paddingTop: 14 },
    signOutAction: { marginTop: 8 },
    actionText: { flex: 1, color: colors.foreground, fontSize: 14, fontWeight: "700" },
    primaryButton: { minHeight: 46, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderRadius: 12, marginTop: 18 },
    primaryButtonText: { color: colors.primaryForeground, fontWeight: "800" },
    secondaryButton: { minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginTop: 10 },
    secondaryButtonText: { color: colors.primary, fontWeight: "700" },
    portalSection: { marginTop: 28, paddingTop: 18, borderTopWidth: 1, borderColor: colors.border },
    sectionTitle: { color: colors.foreground, fontSize: 16, fontWeight: "800" },
    portalLink: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: colors.border },
    portalLinkText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  });
}
