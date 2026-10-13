import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import {
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import type { ImageSourcePropType } from 'react-native';

type CategoryId = 'pantry' | 'oil' | 'dairy' | 'vegetables';
type Product = {
  id: string;
  name: string;
  unit: string;
  price: number;
  category: CategoryId;
  image: ImageSourcePropType;
  note: string;
};
type CartLine = Product & { quantity: number };
type CheckoutErrors = { name?: string; phone?: string; address?: string };
type SubmittedOrder = {
  reference: string;
  customerName: string;
  phone: string;
  address: string;
  items: CartLine[];
  total: number;
};

const products: Product[] = [
  {
    id: 'rice',
    name: 'মিনিকেট চাল',
    unit: '১ কেজি',
    price: 78,
    category: 'pantry',
    image: require('@/assets/images/pantry-staples.png'),
    note: 'নরম ও সুগন্ধি',
  },
  {
    id: 'lentils',
    name: 'মসুর ডাল',
    unit: '১ কেজি',
    price: 130,
    category: 'pantry',
    image: require('@/assets/images/pantry-staples.png'),
    note: 'বাছাই করা',
  },
  {
    id: 'oil',
    name: 'সয়াবিন তেল',
    unit: '১ লিটার',
    price: 170,
    category: 'oil',
    image: require('@/assets/images/pantry-staples.png'),
    note: 'পরিবারের পছন্দ',
  },
  {
    id: 'eggs',
    name: 'ফার্মের ডিম',
    unit: '১২টি',
    price: 150,
    category: 'dairy',
    image: require('@/assets/images/dairy.png'),
    note: 'তাজা ও পুষ্টিকর',
  },
  {
    id: 'milk',
    name: 'পাস্তুরিত দুধ',
    unit: '১ লিটার',
    price: 90,
    category: 'dairy',
    image: require('@/assets/images/dairy.png'),
    note: 'প্রতিদিনের সতেজতা',
  },
  {
    id: 'vegetables',
    name: 'মিশ্র তাজা সবজি',
    unit: '১ কেজি',
    price: 65,
    category: 'vegetables',
    image: require('@/assets/images/vegetables.png'),
    note: 'মৌসুমি সবজি',
  },
  {
    id: 'potato',
    name: 'দেশি আলু',
    unit: '১ কেজি',
    price: 38,
    category: 'vegetables',
    image: require('@/assets/images/vegetables.png'),
    note: 'রান্নার জন্য',
  },
  {
    id: 'tomato',
    name: 'পাকা টমেটো',
    unit: '১ কেজি',
    price: 55,
    category: 'vegetables',
    image: require('@/assets/images/vegetables.png'),
    note: 'টাটকা বাজার থেকে',
  },
];

const categories: { id: 'all' | CategoryId; label: string; icon: string }[] = [
  { id: 'all', label: 'সব পণ্য', icon: 'grid' },
  { id: 'pantry', label: 'চাল ও ডাল', icon: 'archive' },
  { id: 'oil', label: 'তেল', icon: 'droplet' },
  { id: 'dairy', label: 'ডিম ও দুধ', icon: 'coffee' },
  { id: 'vegetables', label: 'শাকসবজি', icon: 'sun' },
];

const toBanglaDigits = (value: number) =>
  String(value).replace(/\d/g, (digit) => '০১২৩৪৫৬৭৮৯'[Number(digit)]);
const taka = (value: number) => `৳${toBanglaDigits(value)}`;
const deliveryCharge = 30;

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [screen, setScreen] = useState<'home' | 'cart'>('home');
  const [selectedCategory, setSelectedCategory] = useState<'all' | CategoryId>(
    'all',
  );
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [lastOrder, setLastOrder] = useState<SubmittedOrder | null>(null);

  const cartLines: CartLine[] = products
    .filter((product) => (cart[product.id] ?? 0) > 0)
    .map((product) => ({ ...product, quantity: cart[product.id] }));
  const itemCount = cartLines.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartLines.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const total = subtotal + (itemCount ? deliveryCharge : 0);
  const filteredProducts = products.filter((product) => {
    const categoryMatches =
      selectedCategory === 'all' || product.category === selectedCategory;
    const query = search.trim().toLocaleLowerCase();
    const searchMatches =
      !query ||
      product.name.toLocaleLowerCase().includes(query) ||
      product.note.toLocaleLowerCase().includes(query);
    return categoryMatches && searchMatches;
  });
  const columns = width >= 1120 ? 4 : width >= 720 ? 3 : 2;
  const contentWidth = Math.min(width, 1180) - 40;
  const cardWidth = (contentWidth - (columns - 1) * 14) / columns;
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : Math.max(insets.bottom, 6);

  const feelTap = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const updateQuantity = (productId: string, delta: number) => {
    feelTap();
    setLastOrder(null);
    setCart((current) => {
      const nextQuantity = (current[productId] ?? 0) + delta;
      const next = { ...current };
      if (nextQuantity <= 0) delete next[productId];
      else next[productId] = nextQuantity;
      return next;
    });
  };

  const placeOrder = () => {
    Keyboard.dismiss();
    const nextErrors: CheckoutErrors = {};
    if (!customerName.trim()) nextErrors.name = 'আপনার নাম লিখুন';
    const digits = phone.replace(/\D/g, '');
    if (!(digits.length === 11 || (digits.startsWith('880') && digits.length === 13))) {
      nextErrors.phone = 'সঠিক ১১ সংখ্যার মোবাইল নম্বর লিখুন';
    }
    if (!address.trim()) nextErrors.address = 'ডেলিভারি ঠিকানা লিখুন';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || cartLines.length === 0) return;

    setLastOrder({
      reference: `HM${Date.now().toString().slice(-6)}`,
      customerName: customerName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      items: cartLines,
      total,
    });
    setCart({});
    setErrors({});
  };

  const goHome = () => {
    Keyboard.dismiss();
    setScreen('home');
  };

  return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <KeyboardAvoidingView
        style={styles.keyboardRoot}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <View
          style={[
            styles.header,
            { backgroundColor: colors.primary, paddingTop: topInset },
          ]}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerTopRow}>
              <View style={styles.brandBlock}>
                <View style={styles.brandIcon}>
                  <MaterialCommunityIcons
                    name="basket-outline"
                    size={23}
                    color={colors.primary}
                  />
                </View>
                <View>
                  <Text style={styles.brandName}>Homna Mart</Text>
                  <View style={styles.locationRow}>
                    <Ionicons
                      name="location-outline"
                      size={13}
                      color={colors.whiteOverlay}
                    />
                    <Text style={styles.locationText}>হোমনা, কুমিল্লা</Text>
                  </View>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`কার্ট, ${toBanglaDigits(itemCount)}টি পণ্য`}
                testID="header-cart-button"
                onPress={() => {
                  feelTap();
                  setScreen('cart');
                }}
                style={({ pressed }) => [
                  styles.headerCartButton,
                  pressed && styles.pressed,
                ]}
              >
                <Feather
                  name="shopping-bag"
                  size={21}
                  color={colors.primaryForeground}
                />
                {itemCount > 0 && (
                  <View style={styles.headerCartBadge}>
                    <Text style={styles.headerCartBadgeText}>
                      {toBanglaDigits(itemCount)}
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
            {screen === 'home' && (
              <View style={styles.searchBox}>
                <Feather name="search" size={18} color={colors.mutedForeground} />
                <TextInput
                  accessibilityLabel="পণ্য খুঁজুন"
                  testID="product-search"
                  value={search}
                  onChangeText={setSearch}
                  placeholder="চাল, ডাল, সবজি খুঁজুন..."
                  placeholderTextColor={colors.mutedForeground}
                  returnKeyType="search"
                  style={styles.searchInput}
                />
                {search.length > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="সার্চ মুছুন"
                    onPress={() => setSearch('')}
                    hitSlop={10}
                  >
                    <Feather name="x-circle" size={17} color={colors.mutedForeground} />
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </View>

        {screen === 'home' ? (
          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={[
              styles.homeContent,
              { paddingBottom: 24 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heroCard}>
              <View style={styles.heroCopy}>
                <View style={styles.heroEyebrow}>
                  <View style={styles.heroDot} />
                  <Text style={styles.heroEyebrowText}>আপনার পাড়ার বাজার</Text>
                </View>
                <Text style={styles.heroTitle}>তাজা বাজার,{'\n'}ঘরেই আপনার</Text>
                <Text style={styles.heroSubtext}>
                  হোমনার পছন্দের নিত্যপণ্য, এক জায়গায়।
                </Text>
                <Pressable
                  accessibilityRole="button"
                  testID="shop-now-button"
                  onPress={() => {
                    setSelectedCategory('all');
                    setSearch('');
                  }}
                  style={({ pressed }) => [
                    styles.heroButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.heroButtonText}>বাজার শুরু করুন</Text>
                  <Feather name="arrow-right" size={16} color={colors.primary} />
                </Pressable>
              </View>
              <Image
                source={require('@/assets/images/vegetables.png')}
                style={styles.heroImage}
                resizeMode="cover"
                accessibilityLabel="তাজা সবজি"
              />
              <View style={styles.heroGlow} />
            </View>

            <View style={styles.sectionHeadingRow}>
              <View>
                <Text style={styles.sectionTitle}>ক্যাটাগরি</Text>
                <Text style={styles.sectionHint}>যা দরকার, বেছে নিন</Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}
              keyboardShouldPersistTaps="handled"
            >
              {categories.map((category) => {
                const selected = selectedCategory === category.id;
                return (
                  <Pressable
                    key={category.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    testID={`category-${category.id}`}
                    onPress={() => {
                      feelTap();
                      setSelectedCategory(category.id);
                    }}
                    style={({ pressed }) => [
                      styles.categoryChip,
                      selected && styles.categoryChipSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Feather
                      name={category.icon as React.ComponentProps<typeof Feather>['name']}
                      size={15}
                      color={selected ? colors.primaryForeground : colors.primary}
                    />
                    <Text
                      style={[
                        styles.categoryLabel,
                        selected && styles.categoryLabelSelected,
                      ]}
                    >
                      {category.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={[styles.sectionHeadingRow, styles.productsHeading]}>
              <View>
                <Text style={styles.sectionTitle}>
                  {selectedCategory === 'all'
                    ? 'আজকের বাজার'
                    : categories.find((category) => category.id === selectedCategory)?.label}
                </Text>
                <Text style={styles.sectionHint}>
                  {toBanglaDigits(filteredProducts.length)}টি পণ্য পাওয়া গেছে
                </Text>
              </View>
              <View style={styles.localTag}>
                <Ionicons name="flash-outline" size={13} color={colors.primary} />
                <Text style={styles.localTagText}>স্থানীয় বাজার</Text>
              </View>
            </View>

            {filteredProducts.length > 0 ? (
              <View style={styles.productGrid}>
                {filteredProducts.map((product) => {
                  const quantity = cart[product.id] ?? 0;
                  return (
                    <View
                      key={product.id}
                      style={[styles.productCard, { width: cardWidth }]}
                    >
                      <View style={styles.productImageWrap}>
                        <Image
                          source={product.image}
                          style={styles.productImage}
                          resizeMode="cover"
                          accessibilityLabel={product.name}
                        />
                        <View style={styles.productNote}>
                          <Text style={styles.productNoteText}>{product.note}</Text>
                        </View>
                      </View>
                      <View style={styles.productDetails}>
                        <Text style={styles.productName} numberOfLines={1}>
                          {product.name}
                        </Text>
                        <Text style={styles.productUnit}>{product.unit}</Text>
                        <View style={styles.productActionRow}>
                          <Text style={styles.productPrice}>{taka(product.price)}</Text>
                          {quantity === 0 ? (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`${product.name} কার্টে যোগ করুন`}
                              testID={`add-${product.id}`}
                              onPress={() => updateQuantity(product.id, 1)}
                              style={({ pressed }) => [
                                styles.addButton,
                                pressed && styles.pressed,
                              ]}
                            >
                              <Feather name="plus" size={17} color={colors.primaryForeground} />
                            </Pressable>
                          ) : (
                            <View style={styles.quantityControl}>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`${product.name} কমান`}
                                testID={`decrease-${product.id}`}
                                hitSlop={8}
                                onPress={() => updateQuantity(product.id, -1)}
                                style={styles.quantityButton}
                              >
                                <Feather name="minus" size={14} color={colors.primary} />
                              </Pressable>
                              <Text style={styles.quantityText}>
                                {toBanglaDigits(quantity)}
                              </Text>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`${product.name} বাড়ান`}
                                testID={`increase-${product.id}`}
                                hitSlop={8}
                                onPress={() => updateQuantity(product.id, 1)}
                                style={styles.quantityButton}
                              >
                                <Feather name="plus" size={14} color={colors.primary} />
                              </Pressable>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.noResults}>
                <Feather name="search" size={23} color={colors.mutedForeground} />
                <Text style={styles.noResultsTitle}>কোনো পণ্য পাওয়া যায়নি</Text>
                <Text style={styles.noResultsBody}>অন্য নামে খুঁজে দেখুন</Text>
              </View>
            )}
            <View style={styles.footerNote}>
              <Feather name="map-pin" size={14} color={colors.primary} />
              <Text style={styles.footerNoteText}>
                হোমনা ও আশেপাশে স্থানীয় ডেলিভারি
              </Text>
            </View>
          </ScrollView>
        ) : (
          <KeyboardAwareScrollViewCompat
            style={styles.bodyScroll}
            contentContainerStyle={[
              styles.cartContent,
              { paddingBottom: bottomInset + 24 },
            ]}
            bottomOffset={72}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {lastOrder ? (
              <View style={styles.confirmationWrap}>
                <View style={styles.confirmationIcon}>
                  <Feather name="check" size={32} color={colors.primaryForeground} />
                </View>
                <Text style={styles.confirmationTitle}>অর্ডারটি নেওয়া হয়েছে!</Text>
                <Text style={styles.confirmationBody}>
                  ধন্যবাদ, {lastOrder.customerName}। ডেলিভারি নিশ্চিত করতে আমরা
                  আপনার সঙ্গে যোগাযোগ করব।
                </Text>
                <View style={styles.receiptCard}>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>অর্ডার নম্বর</Text>
                    <Text style={styles.receiptValue}>{lastOrder.reference}</Text>
                  </View>
                  <View style={styles.receiptDivider} />
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>মোবাইল</Text>
                    <Text style={styles.receiptValue}>{lastOrder.phone}</Text>
                  </View>
                  <View style={styles.receiptDivider} />
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>মোট</Text>
                    <Text style={styles.receiptTotal}>{taka(lastOrder.total)}</Text>
                  </View>
                  <View style={styles.receiptDivider} />
                  <Text style={styles.receiptLabel}>ডেলিভারি ঠিকানা</Text>
                  <Text style={styles.receiptAddress}>{lastOrder.address}</Text>
                  <View style={styles.codReceipt}>
                    <Feather name="truck" size={15} color={colors.primary} />
                    <Text style={styles.codReceiptText}>ক্যাশ অন ডেলিভারি</Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  testID="continue-shopping"
                  onPress={goHome}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>আরও কেনাকাটা করুন</Text>
                  <Feather name="arrow-right" size={17} color={colors.primaryForeground} />
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.cartTitleRow}>
                  <View>
                    <Text style={styles.pageTitle}>আপনার ঝুড়ি</Text>
                    <Text style={styles.sectionHint}>
                      {itemCount
                        ? `${toBanglaDigits(itemCount)}টি পণ্য`
                        : 'পছন্দের পণ্যগুলো এখানে দেখুন'}
                    </Text>
                  </View>
                  {itemCount > 0 && (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setCart({})}
                      style={styles.clearCartButton}
                    >
                      <Feather name="trash-2" size={14} color={colors.destructive} />
                      <Text style={styles.clearCartText}>সব মুছুন</Text>
                    </Pressable>
                  )}
                </View>
                {cartLines.length === 0 ? (
                  <View style={styles.emptyCart}>
                    <View style={styles.emptyCartIcon}>
                      <Feather name="shopping-bag" size={30} color={colors.primary} />
                    </View>
                    <Text style={styles.emptyCartTitle}>আপনার ঝুড়ি এখন খালি</Text>
                    <Text style={styles.emptyCartText}>
                      বাজারের পণ্য যোগ করে অর্ডার শুরু করুন।
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      testID="browse-products"
                      onPress={goHome}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.primaryButtonText}>পণ্য দেখুন</Text>
                      <Feather name="arrow-right" size={16} color={colors.primaryForeground} />
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <View style={styles.cartList}>
                      {cartLines.map((item) => (
                        <View key={item.id} style={styles.cartItem}>
                          <Image
                            source={item.image}
                            style={styles.cartItemImage}
                            resizeMode="cover"
                            accessibilityLabel={item.name}
                          />
                          <View style={styles.cartItemInfo}>
                            <Text style={styles.cartItemName}>{item.name}</Text>
                            <Text style={styles.cartItemUnit}>{item.unit}</Text>
                            <Text style={styles.cartItemPrice}>
                              {taka(item.price * item.quantity)}
                            </Text>
                          </View>
                          <View style={styles.quantityControl}>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`${item.name} কমান`}
                              testID={`cart-decrease-${item.id}`}
                              hitSlop={8}
                              onPress={() => updateQuantity(item.id, -1)}
                              style={styles.quantityButton}
                            >
                              <Feather name="minus" size={14} color={colors.primary} />
                            </Pressable>
                            <Text style={styles.quantityText}>
                              {toBanglaDigits(item.quantity)}
                            </Text>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`${item.name} বাড়ান`}
                              testID={`cart-increase-${item.id}`}
                              hitSlop={8}
                              onPress={() => updateQuantity(item.id, 1)}
                              style={styles.quantityButton}
                            >
                              <Feather name="plus" size={14} color={colors.primary} />
                            </Pressable>
                          </View>
                        </View>
                      ))}
                    </View>

                    <View style={styles.orderSummary}>
                      <Text style={styles.summaryTitle}>অর্ডারের হিসাব</Text>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>পণ্যের দাম</Text>
                        <Text style={styles.summaryValue}>{taka(subtotal)}</Text>
                      </View>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>ডেলিভারি চার্জ</Text>
                        <Text style={styles.summaryValue}>{taka(deliveryCharge)}</Text>
                      </View>
                      <View style={styles.summaryDivider} />
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryTotalLabel}>সর্বমোট</Text>
                        <Text style={styles.summaryTotal}>{taka(total)}</Text>
                      </View>
                    </View>

                    <View style={styles.checkoutSection}>
                      <Text style={styles.sectionTitle}>ডেলিভারির তথ্য</Text>
                      <Text style={styles.checkoutHint}>
                        হোমনা, কুমিল্লার মধ্যে আপনার ঠিকানা দিন
                      </Text>

                      <Text style={styles.fieldLabel}>আপনার নাম</Text>
                      <TextInput
                        accessibilityLabel="আপনার নাম"
                        testID="checkout-name"
                        value={customerName}
                        onChangeText={(value) => {
                          setCustomerName(value);
                          if (errors.name) setErrors((current) => ({ ...current, name: undefined }));
                        }}
                        placeholder="যেমন: রহিম উদ্দিন"
                        placeholderTextColor={colors.mutedForeground}
                        returnKeyType="next"
                        style={[styles.formInput, errors.name && styles.formInputError]}
                      />
                      {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

                      <Text style={styles.fieldLabel}>মোবাইল নম্বর</Text>
                      <TextInput
                        accessibilityLabel="মোবাইল নম্বর"
                        testID="checkout-phone"
                        value={phone}
                        onChangeText={(value) => {
                          setPhone(value);
                          if (errors.phone) setErrors((current) => ({ ...current, phone: undefined }));
                        }}
                        placeholder="01XXXXXXXXX"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="phone-pad"
                        returnKeyType="next"
                        style={[styles.formInput, errors.phone && styles.formInputError]}
                      />
                      {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}

                      <Text style={styles.fieldLabel}>ডেলিভারি ঠিকানা</Text>
                      <TextInput
                        accessibilityLabel="ডেলিভারি ঠিকানা"
                        testID="checkout-address"
                        value={address}
                        onChangeText={(value) => {
                          setAddress(value);
                          if (errors.address) setErrors((current) => ({ ...current, address: undefined }));
                        }}
                        placeholder="গ্রাম/এলাকা, ওয়ার্ড ও পরিচিত স্থান লিখুন"
                        placeholderTextColor={colors.mutedForeground}
                        multiline
                        textAlignVertical="top"
                        style={[
                          styles.formInput,
                          styles.addressInput,
                          errors.address && styles.formInputError,
                        ]}
                      />
                      {errors.address && (
                        <Text style={styles.errorText}>{errors.address}</Text>
                      )}

                      <View style={styles.paymentCard}>
                        <View style={styles.paymentIcon}>
                          <Feather name="truck" size={18} color={colors.primary} />
                        </View>
                        <View style={styles.paymentCopy}>
                          <Text style={styles.paymentTitle}>Cash on Delivery</Text>
                          <Text style={styles.paymentSubtitle}>পণ্য হাতে পেয়ে টাকা দিন</Text>
                        </View>
                        <View style={styles.radioOuter}>
                          <View style={styles.radioInner} />
                        </View>
                      </View>

                      <Pressable
                        accessibilityRole="button"
                        testID="place-order-button"
                        onPress={placeOrder}
                        style={({ pressed }) => [
                          styles.primaryButton,
                          styles.placeOrderButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.primaryButtonText}>অর্ডার নিশ্চিত করুন</Text>
                        <Feather name="arrow-right" size={17} color={colors.primaryForeground} />
                      </Pressable>
                      <Text style={styles.secureNote}>
                        অর্ডার নিশ্চিত করতে কোনো অগ্রিম পেমেন্ট লাগবে না
                      </Text>
                    </View>
                  </>
                )}
              </>
            )}
          </KeyboardAwareScrollViewCompat>
        )}

        <View
          style={[
            styles.bottomBar,
            {
              paddingBottom: bottomInset,
              minHeight: Platform.OS === 'web' ? 84 : undefined,
            },
          ]}
        >
          <View style={styles.bottomBarInner}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: screen === 'home' }}
              testID="home-tab"
              onPress={goHome}
              style={({ pressed }) => [
                styles.navItem,
                screen === 'home' && styles.navItemActive,
                pressed && styles.pressed,
              ]}
            >
              <Feather
                name="home"
                size={19}
                color={screen === 'home' ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.navLabel,
                  screen === 'home' && styles.navLabelActive,
                ]}
              >
                হোম
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: screen === 'cart' }}
              testID="cart-tab"
              onPress={() => {
                Keyboard.dismiss();
                setScreen('cart');
              }}
              style={({ pressed }) => [
                styles.navItem,
                screen === 'cart' && styles.navItemActive,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.navCartIcon}>
                <Feather
                  name="shopping-bag"
                  size={19}
                  color={screen === 'cart' ? colors.primary : colors.mutedForeground}
                />
                {itemCount > 0 && (
                  <View style={styles.navBadge}>
                    <Text style={styles.navBadgeText}>
                      {toBanglaDigits(itemCount)}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.navLabel,
                  screen === 'cart' && styles.navLabelActive,
                ]}
              >
                ঝুড়ি
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function makeStyles(
  colors: ReturnType<typeof useColors>,
) {
  return StyleSheet.create({
    root: { flex: 1 },
    keyboardRoot: { flex: 1 },
    header: { paddingBottom: 15 },
    headerContent: {
      width: '100%',
      maxWidth: 1180,
      alignSelf: 'center',
      paddingHorizontal: 20,
    },
    headerTopRow: {
      minHeight: 48,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 15,
    },
    brandBlock: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    brandIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: colors.white,
      alignItems: 'center',
      justifyContent: 'center',
    },
    brandName: {
      color: colors.primaryForeground,
      fontFamily: 'Inter_700Bold',
      fontSize: 18,
      letterSpacing: -0.3,
    },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
    locationText: { color: colors.whiteOverlay, fontSize: 12 },
    headerCartButton: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCartBadge: {
      position: 'absolute',
      right: 0,
      top: 0,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 10,
      backgroundColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCartBadgeText: { color: colors.foreground, fontSize: 10, fontWeight: '700' },
    searchBox: {
      height: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      borderRadius: 15,
      backgroundColor: colors.card,
    },
    searchInput: {
      flex: 1,
      color: colors.foreground,
      paddingVertical: 0,
      fontSize: 14,
      minHeight: 44,
    },
    bodyScroll: { flex: 1 },
    homeContent: {
      width: '100%',
      maxWidth: 1180,
      alignSelf: 'center',
      paddingHorizontal: 20,
      paddingTop: 18,
    },
    heroCard: {
      minHeight: 186,
      borderRadius: 23,
      backgroundColor: colors.primaryDark,
      padding: 20,
      overflow: 'hidden',
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 25,
    },
    heroCopy: { flex: 1, zIndex: 2, paddingRight: 2 },
    heroEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 9 },
    heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold },
    heroEyebrowText: { color: colors.primarySoft, fontSize: 11, fontWeight: '600' },
    heroTitle: {
      color: colors.primaryForeground,
      fontSize: 24,
      lineHeight: 34,
      fontWeight: '700',
      letterSpacing: -0.4,
    },
    heroSubtext: { color: colors.primaryMuted, fontSize: 12, lineHeight: 19, marginTop: 3 },
    heroButton: {
      marginTop: 13,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: colors.card,
      paddingHorizontal: 13,
      paddingVertical: 9,
      borderRadius: 12,
    },
    heroButtonText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
    heroImage: {
      width: 126,
      height: 126,
      borderRadius: 63,
      marginLeft: -5,
      borderWidth: 4,
      borderColor: colors.whiteBorder,
    },
    heroGlow: {
      position: 'absolute',
      width: 180,
      height: 180,
      borderRadius: 90,
      right: -30,
      top: 10,
      backgroundColor: colors.greenGlow,
    },
    sectionHeadingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionTitle: { color: colors.foreground, fontSize: 18, fontWeight: '700' },
    sectionHint: { color: colors.mutedForeground, fontSize: 12, marginTop: 3 },
    categoryRow: { gap: 9, paddingVertical: 13, paddingRight: 4 },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 13,
      paddingVertical: 10,
      borderRadius: 13,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    categoryChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    categoryLabel: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
    categoryLabelSelected: { color: colors.primaryForeground },
    productsHeading: { marginTop: 5, marginBottom: 13 },
    localTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.accent,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 20,
    },
    localTagText: { color: colors.accentForeground, fontSize: 10, fontWeight: '600' },
    productGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-start',
      gap: 14,
    },
    productCard: {
      overflow: 'hidden',
      borderRadius: 18,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    productImageWrap: {
      height: 124,
      backgroundColor: colors.muted,
      overflow: 'hidden',
    },
    productImage: { width: '100%', height: '100%' },
    productNote: {
      position: 'absolute',
      left: 8,
      top: 8,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: colors.whiteOverlayStrong,
    },
    productNoteText: { color: colors.primary, fontSize: 9, fontWeight: '700' },
    productDetails: { padding: 11 },
    productName: { color: colors.foreground, fontSize: 14, fontWeight: '700' },
    productUnit: { color: colors.mutedForeground, fontSize: 11, marginTop: 3 },
    productActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 11,
      minHeight: 34,
    },
    productPrice: { color: colors.primary, fontSize: 16, fontWeight: '800' },
    addButton: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    quantityControl: {
      height: 34,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 5,
      paddingHorizontal: 4,
      borderRadius: 12,
      backgroundColor: colors.accent,
    },
    quantityButton: {
      width: 27,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quantityText: {
      minWidth: 16,
      textAlign: 'center',
      color: colors.foreground,
      fontWeight: '700',
      fontSize: 13,
    },
    noResults: {
      minHeight: 180,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      backgroundColor: colors.card,
    },
    noResultsTitle: { color: colors.foreground, fontSize: 15, fontWeight: '700' },
    noResultsBody: { color: colors.mutedForeground, fontSize: 12 },
    footerNote: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingTop: 21,
      paddingBottom: 5,
    },
    footerNoteText: { color: colors.mutedForeground, fontSize: 11 },
    cartContent: {
      width: '100%',
      maxWidth: 790,
      alignSelf: 'center',
      paddingHorizontal: 20,
      paddingTop: 22,
    },
    cartTitleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 17,
    },
    pageTitle: { color: colors.foreground, fontSize: 23, fontWeight: '800' },
    clearCartButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 7,
      paddingHorizontal: 9,
    },
    clearCartText: { color: colors.destructive, fontSize: 12, fontWeight: '600' },
    emptyCart: {
      alignItems: 'center',
      paddingHorizontal: 22,
      paddingTop: 54,
      paddingBottom: 65,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      backgroundColor: colors.card,
    },
    emptyCartIcon: {
      width: 68,
      height: 68,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      marginBottom: 16,
    },
    emptyCartTitle: { color: colors.foreground, fontSize: 18, fontWeight: '700' },
    emptyCartText: {
      color: colors.mutedForeground,
      fontSize: 13,
      textAlign: 'center',
      marginTop: 7,
      marginBottom: 18,
    },
    cartList: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
    },
    cartItem: {
      minHeight: 94,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    cartItemImage: {
      width: 66,
      height: 66,
      borderRadius: 13,
      backgroundColor: colors.muted,
    },
    cartItemInfo: { flex: 1 },
    cartItemName: { color: colors.foreground, fontSize: 14, fontWeight: '700' },
    cartItemUnit: { color: colors.mutedForeground, fontSize: 11, marginTop: 3 },
    cartItemPrice: { color: colors.primary, fontSize: 14, fontWeight: '700', marginTop: 4 },
    orderSummary: {
      marginTop: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 17,
      backgroundColor: colors.card,
    },
    summaryTitle: { color: colors.foreground, fontSize: 15, fontWeight: '700', marginBottom: 10 },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 5,
    },
    summaryLabel: { color: colors.mutedForeground, fontSize: 13 },
    summaryValue: { color: colors.foreground, fontSize: 13, fontWeight: '600' },
    summaryDivider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
    summaryTotalLabel: { color: colors.foreground, fontSize: 15, fontWeight: '700' },
    summaryTotal: { color: colors.primary, fontSize: 18, fontWeight: '800' },
    checkoutSection: {
      marginTop: 23,
      marginBottom: 12,
      padding: 17,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    checkoutHint: { color: colors.mutedForeground, fontSize: 12, marginTop: 4, marginBottom: 16 },
    fieldLabel: { color: colors.foreground, fontSize: 13, fontWeight: '600', marginBottom: 7, marginTop: 13 },
    formInput: {
      minHeight: 48,
      paddingHorizontal: 13,
      borderWidth: 1,
      borderColor: colors.input,
      borderRadius: 12,
      backgroundColor: colors.background,
      color: colors.foreground,
      fontSize: 14,
    },
    formInputError: { borderColor: colors.destructive },
    addressInput: { height: 86, paddingTop: 12 },
    errorText: { color: colors.destructive, fontSize: 11, marginTop: 5 },
    paymentCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      marginTop: 20,
      padding: 13,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: 14,
      backgroundColor: colors.accent,
    },
    paymentIcon: {
      width: 38,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: colors.card,
    },
    paymentCopy: { flex: 1 },
    paymentTitle: { color: colors.foreground, fontSize: 13, fontWeight: '700' },
    paymentSubtitle: { color: colors.mutedForeground, fontSize: 11, marginTop: 3 },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
    primaryButton: {
      minHeight: 50,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 9,
      backgroundColor: colors.primary,
      paddingHorizontal: 18,
      borderRadius: 14,
    },
    primaryButtonText: { color: colors.primaryForeground, fontSize: 14, fontWeight: '700' },
    placeOrderButton: { marginTop: 18 },
    secureNote: {
      color: colors.mutedForeground,
      textAlign: 'center',
      fontSize: 11,
      marginTop: 10,
    },
    confirmationWrap: { alignItems: 'center', paddingTop: 29, paddingBottom: 40 },
    confirmationIcon: {
      width: 66,
      height: 66,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 15,
    },
    confirmationTitle: { color: colors.foreground, fontSize: 21, fontWeight: '800' },
    confirmationBody: {
      color: colors.mutedForeground,
      textAlign: 'center',
      fontSize: 13,
      lineHeight: 21,
      marginTop: 8,
      maxWidth: 400,
    },
    receiptCard: {
      width: '100%',
      marginTop: 23,
      marginBottom: 18,
      padding: 17,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      backgroundColor: colors.card,
    },
    receiptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    receiptLabel: { color: colors.mutedForeground, fontSize: 12 },
    receiptValue: { color: colors.foreground, fontSize: 13, fontWeight: '600' },
    receiptTotal: { color: colors.primary, fontSize: 17, fontWeight: '800' },
    receiptDivider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
    receiptAddress: { color: colors.foreground, fontSize: 13, lineHeight: 20, marginTop: 5 },
    codReceipt: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: colors.accent,
      alignSelf: 'flex-start',
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginTop: 14,
    },
    codReceiptText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
    bottomBar: {
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 7,
    },
    bottomBarInner: {
      width: '100%',
      maxWidth: 560,
      alignSelf: 'center',
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      minHeight: 46,
    },
    navItem: {
      minWidth: 90,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      paddingHorizontal: 14,
      paddingVertical: 4,
      borderRadius: 12,
    },
    navItemActive: { backgroundColor: colors.accent },
    navLabel: { color: colors.mutedForeground, fontSize: 10, fontWeight: '600' },
    navLabelActive: { color: colors.primary },
    navCartIcon: { position: 'relative' },
    navBadge: {
      position: 'absolute',
      top: -6,
      right: -9,
      minWidth: 15,
      height: 15,
      borderRadius: 8,
      paddingHorizontal: 3,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    navBadgeText: { color: colors.primaryForeground, fontSize: 8, fontWeight: '700' },
    pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  });
}
