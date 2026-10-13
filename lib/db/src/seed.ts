import { db, pool } from "./index";
import { categories } from "./schema/categories";
import { products } from "./schema/products";
import { storeSettings } from "./schema/store-settings";

const categorySeeds = [
  { slug: "pantry", name: "চাল ও ডাল", sortOrder: 1 },
  { slug: "oil", name: "তেল", sortOrder: 2 },
  { slug: "dairy", name: "ডিম ও দুধ", sortOrder: 3 },
  { slug: "vegetables", name: "শাকসবজি", sortOrder: 4 },
];

const productSeeds = [
  { slug: "rice", name: "মিনিকেট চাল", description: "নরম ও সুগন্ধি", unit: "১ কেজি", price: "78", stock: 100, categorySlug: "pantry" },
  { slug: "lentils", name: "মসুর ডাল", description: "বাছাই করা", unit: "১ কেজি", price: "130", stock: 100, categorySlug: "pantry" },
  { slug: "oil", name: "সয়াবিন তেল", description: "পরিবারের পছন্দ", unit: "১ লিটার", price: "170", stock: 100, categorySlug: "oil" },
  { slug: "eggs", name: "ফার্মের ডিম", description: "তাজা ও পুষ্টিকর", unit: "১২টি", price: "150", stock: 100, categorySlug: "dairy" },
  { slug: "milk", name: "পাস্তুরিত দুধ", description: "প্রতিদিনের সতেজতা", unit: "১ লিটার", price: "90", stock: 100, categorySlug: "dairy" },
  { slug: "vegetables", name: "মিশ্র তাজা সবজি", description: "মৌসুমি সবজি", unit: "১ কেজি", price: "65", stock: 100, categorySlug: "vegetables" },
  { slug: "potato", name: "দেশি আলু", description: "রান্নার জন্য", unit: "১ কেজি", price: "38", stock: 100, categorySlug: "vegetables" },
  { slug: "tomato", name: "পাকা টমেটো", description: "টাটকা বাজার থেকে", unit: "১ কেজি", price: "55", stock: 100, categorySlug: "vegetables" },
];

async function seed() {
  await db.insert(categories).values(categorySeeds).onConflictDoNothing();
  const savedCategories = await db.select().from(categories);
  const categoryIds = new Map(savedCategories.map((category) => [category.slug, category.id]));

  await db
    .insert(products)
    .values(
      productSeeds.map(({ categorySlug, ...product }) => ({
        ...product,
        categoryId: categoryIds.get(categorySlug) ?? null,
        imageUrl: null,
        isVisible: true,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(storeSettings)
    .values({
      id: 1,
      storeName: "Homna Mart",
      deliveryCharge: "30",
      minimumOrder: "0",
      deliveryOptions: [
        { id: "homna-town", label: "হোমনা সদর", fee: 30, active: true },
        { id: "nearby", label: "আশেপাশের এলাকা", fee: 50, active: true },
      ],
    })
    .onConflictDoNothing();
}

seed()
  .then(async () => {
    console.log("Homna Mart sample catalog is ready.");
    await pool.end();
  })
  .catch(async (error) => {
    console.error("Homna Mart seed failed.", error);
    await pool.end();
    process.exitCode = 1;
  });
