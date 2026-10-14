import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useGetMyOrders } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

const statusLabels: Record<string, string> = {
  pending: "নতুন",
  confirmed: "নিশ্চিত",
  preparing: "প্রস্তুত হচ্ছে",
  out_for_delivery: "ডেলিভারি পথে",
  delivered: "সম্পন্ন",
  cancelled: "বাতিল",
};
const bangla = (value: number) => String(value).replace(/\d/g, (digit) => "০১২৩৪৫৬৭৮৯"[Number(digit)]);

export default function OrdersScreen() {
  const colors = useColors();
  const styles = makeStyles(colors);
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const ordersQuery = useGetMyOrders({ query: { enabled: Boolean(isSignedIn), retry: false } });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>HOMNA MART</Text>
        <Text style={styles.title}>আমার অর্ডার</Text>
        {!isLoaded || (isSignedIn && ordersQuery.isLoading) ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 36 }} />
        ) : !isSignedIn ? (
          <View style={styles.emptyCard}>
            <Feather name="package" size={30} color={colors.primary} />
            <Text style={styles.cardTitle}>অর্ডার দেখতে লগইন করুন</Text>
            <Text style={styles.muted}>লগইন থাকা অবস্থায় করা অর্ডারগুলো এখানে দেখা যাবে।</Text>
            <Pressable onPress={() => router.push("/sign-in" as Href)} style={styles.button}>
              <Text style={styles.buttonText}>লগইন</Text>
            </Pressable>
          </View>
        ) : ordersQuery.isError ? (
          <View style={styles.emptyCard}>
            <Text style={styles.cardTitle}>অর্ডার লোড করা যায়নি</Text>
            <Pressable onPress={() => void ordersQuery.refetch()} style={styles.button}>
              <Text style={styles.buttonText}>আবার চেষ্টা করুন</Text>
            </Pressable>
          </View>
        ) : (ordersQuery.data?.orders.length ?? 0) === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="shopping-bag" size={30} color={colors.primary} />
            <Text style={styles.cardTitle}>এখনো কোনো অর্ডার নেই</Text>
            <Pressable onPress={() => router.replace("/" as Href)} style={styles.button}>
              <Text style={styles.buttonText}>বাজার করুন</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            {ordersQuery.data?.orders.map((order) => (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderHeading}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.shop}>{order.shopName}</Text>
                    <Text style={styles.reference}>{order.reference}</Text>
                  </View>
                  <Text style={styles.status}>{statusLabels[order.status] ?? order.status}</Text>
                </View>
                {order.items.map((item, index) => (
                  <Text key={`${order.id}-${index}`} style={styles.itemText}>
                    {item.productName} · {bangla(item.quantity)} {item.unit}
                  </Text>
                ))}
                <View style={styles.orderFooter}>
                  <Text style={styles.muted}>{new Date(order.createdAt).toLocaleDateString("bn-BD")}</Text>
                  <Text style={styles.total}>৳{bangla(order.total)}</Text>
                </View>
                <Text style={styles.payment}>
                  {order.paymentMethod === "cod" ? "ক্যাশ অন ডেলিভারি" : order.paymentMethod} ·{" "}
                  {order.paymentStatus === "paid" ? "পরিশোধিত" : "পরিশোধ বাকি"}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { width: "100%", maxWidth: 900, alignSelf: "center", padding: 20, paddingBottom: 35 },
    kicker: { color: colors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, marginTop: 10 },
    title: { color: colors.foreground, fontSize: 28, fontWeight: "800", marginTop: 4, marginBottom: 18 },
    list: { gap: 13 },
    orderCard: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    orderHeading: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
    shop: { color: colors.foreground, fontSize: 15, fontWeight: "800" },
    reference: { color: colors.mutedForeground, fontSize: 11, marginTop: 2 },
    status: { color: colors.primary, fontSize: 12, fontWeight: "800", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.accent },
    itemText: { color: colors.foreground, fontSize: 12, lineHeight: 19 },
    orderFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderColor: colors.border, marginTop: 10, paddingTop: 10 },
    total: { color: colors.primary, fontSize: 16, fontWeight: "800" },
    payment: { color: colors.mutedForeground, fontSize: 11, marginTop: 6 },
    muted: { color: colors.mutedForeground, fontSize: 12, lineHeight: 18, marginTop: 6 },
    emptyCard: { alignItems: "center", padding: 22, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    cardTitle: { color: colors.foreground, fontSize: 17, fontWeight: "800", marginTop: 12 },
    button: { minHeight: 44, paddingHorizontal: 20, justifyContent: "center", borderRadius: 12, backgroundColor: colors.primary, marginTop: 16 },
    buttonText: { color: colors.primaryForeground, fontSize: 13, fontWeight: "800" },
  });
}
