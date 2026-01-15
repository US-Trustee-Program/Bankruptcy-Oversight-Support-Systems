# Demo Mode - Phonetic & Nickname Search

Demo mode allows you to showcase the full search capabilities **without needing a database**. It uses 50 carefully crafted mock cases to demonstrate all search features, including edge cases with numeric suffixes.

## How to Enable Demo Mode

### Option 1: Environment Variable
```bash
DEMO_MODE=true npm start
```

### Option 2: Add to .env file
```bash
echo "DEMO_MODE=true" >> .env
npm start
```

### Option 3: One-time test
```bash
DEMO_MODE=true npm run start:api
```

---

## Demo Search Scenarios

### 1️⃣ Nickname Matching

**Search: `Mike`**
- ✅ Finds: "Michael Johnson" (nickname)
- ✅ Finds: "Mike Anderson" (exact match)

**Search: `Bill Smith`**
- ✅ Finds: "William Smith" (nickname + exact last name)

**Search: `Bob`**
- ✅ Finds: "Robert Brown" (nickname)
- ✅ Finds: "Bob Wilson" (exact match)

---

### 2️⃣ Phonetic Matching (Misspellings)

**Search: `Jon`**
- ✅ Finds: "John Davis" (phonetic match)
- ✅ Finds: "Jon Miller" (exact match)
- ✅ Finds: "Jonathan Garcia" (phonetic match)

**Search: `Jon Doe`**
- ✅ Finds: "Jon Doe" (exact match)
- ✅ Finds: "John Doe" (phonetic match)
- ✅ Finds: "Jonathan Doe" (phonetic/nickname match)
- ❌ **Correctly filters out**: "Jane Doe" (phonetically similar but wrong name - score 0.78 < 0.83)

**Search: `Smith`**
- ✅ Finds: "Smith Martinez" (exact match)
- ✅ Finds: "Smyth Rodriguez" (phonetic spelling variation)
- ✅ Finds: "John Smith"
- ✅ Finds: "Smith John" (reversed name order)

---

### 3️⃣ Partial Word Matching

**Search: `john sm`**
- ✅ Finds: "John Smith" (partial match on both words)

**Search: `mik joh`**
- ✅ Finds: "Michael Johnson" (partial + nickname expansion)
- ✅ Finds: "Michael Anthony Johnson" (partial + middle name)

**Search: `wil`**
- ✅ Finds: "William Smith" (partial first name)
- ✅ Finds: "William Robert Smith Jr" (partial + complex name)

---

### 4️⃣ Joint Debtor Matching

**Search: `Mike Harris`**
- ✅ Finds: "James Harris (Joint: Michael Harris)" (searches joint debtor)

**Search: `Bill Lee`**
- ✅ Finds: "Sarah Lee (Joint: Bill Lee)"

---

### 5️⃣ False Positive Prevention

**Search: `Jon Doe`**
- ✅ Finds: "Jon Miller" (phonetic + last name partial)
- ✅ Finds: "John Davis" (phonetic match)
- ❌ **Does NOT find**: "Jane Doe" (score 0.78 < threshold 0.83)

This demonstrates the Jaro-Winkler threshold (0.83) successfully filtering false positives!

---

## Demo Cases Included

The demo dataset includes 50 cases covering:

### Nickname Pairs
- Michael Johnson / Mike Anderson
- William Smith / Bill Thompson
- Robert Brown / Bob Wilson

### Phonetic Variations
- John Davis / Jon Miller / Jonathan Garcia
- Smith Martinez / Smyth Rodriguez

### False Positive Tests
- Jane Doe / Jane Wilson (should NOT match "Jon")

### Complex Names
- Michael Anthony Johnson
- William Robert Smith Jr
- Bob Alan Brown III

### Joint Debtor Scenarios
- James Harris (Joint: Michael Harris)
- Sarah Lee (Joint: Bill Lee)
- David Clark (Joint: Jane Clark)

### Name Order Variations
- Smith John
- Johnson Michael

### Numeric Suffix Edge Cases (17 cases)

**Same name, different suffixes:**
- Robert Johnson (base)
- Robert Johnson Jr
- Robert Johnson Sr

**Roman numerals:**
- James Williams II, III, IV

**Ordinal numbers:**
- John Miller 3rd
- William Brown 2nd

**Professional suffixes:**
- Thomas Anderson Esq
- Michael Davis MD

**Business names with numbers:**
- 2nd Street Properties LLC
- 123 Corporation
- ABC Holdings 2
- 21st Century Ventures Inc

**Complex multi-suffix cases:**
- William Smith Jr Esq
- Dr Michael Johnson III

### Chapter Distribution
- **25 Chapter 7 cases** (bankruptcy liquidation)
- **25 Chapter 15 cases** (cross-border insolvency)
- Allows testing chapter filter functionality

---

## Testing the Demo

### Quick Test Script
```bash
# Enable demo mode
export DEMO_MODE=true

# Start the API
npm run start:api

# In another terminal, test searches:
curl "http://localhost:3000/api/v1/cases?debtorName=Mike"
curl "http://localhost:3000/api/v1/cases?debtorName=Jon"
curl "http://localhost:3000/api/v1/cases?debtorName=Bill%20Smith"
```

### UI Testing
1. Start backend with `DEMO_MODE=true npm start`
2. Start frontend
3. Navigate to Case Search
4. Try the demo search scenarios above

---

## Verifying Search Features

Use these searches to demonstrate each capability:

| Feature | Search Query | Expected Results |
|---------|--------------|------------------|
| Nickname matching | `Mike` | Michael Johnson, Mike Anderson |
| Phonetic matching | `Jon` | John Davis, Jon Miller, Jonathan Garcia |
| False positive filter | `Jon` | Does NOT return Jane Doe |
| Partial words | `john sm` | John Smith |
| Joint debtor | `Mike Harris` | James Harris (Joint: Michael Harris) |
| Name misspelling | `Smith` | Smith Martinez, Smyth Rodriguez |

---

## Implementation Details

When `DEMO_MODE=true`, the search flow is:

```
User searches "Mike Johnson"
         ↓
1. Nickname expansion: ["mike", "michael"]
         ↓
2. Regex filter (in-memory): Match cases containing "mike" OR "michael" OR "johnson"
         ↓
3. Application filter: Jaro-Winkler threshold 0.83 + nickname-aware matching
         ↓
Result: "Michael Johnson" returned ✅
```

This is **identical** to the production flow, except:
- Database query → In-memory filter
- All search logic (phonetic, nickname, Jaro-Winkler) remains the same

---

## Disabling Demo Mode

Remove from .env or set to false:
```bash
DEMO_MODE=false
```

Or simply unset the environment variable:
```bash
unset DEMO_MODE
npm start
```

---

## Demo Presentation Tips

1. **Start with nicknames** - Easy to understand
   - Search "Mike" → shows "Michael Johnson"

2. **Show false positive prevention** - Most impressive
   - Search "Jon" → shows John/Jonathan but NOT Jane

3. **Demonstrate partial matching** - Practical use case
   - Search "john sm" → finds "John Smith"

4. **Show phonetic tolerance** - Handles typos
   - Search "Smith" → finds "Smyth" too

5. **Joint debtor search** - Real-world scenario
   - Search "Mike Harris" → finds case where Michael is joint debtor

6. **Numeric suffix handling** - Edge cases
   - Search "Robert Johnson" → finds all variants (base, Jr, Sr)
   - Search "Bill Smith" → finds "William Smith Jr Esq" via nickname
   - Search "James Williams" → finds all II, III, IV variants

---

## Numeric Suffix Behavior

For detailed information about how the system handles names with numeric suffixes (Jr, Sr, II, III, 3rd, etc.), see [NUMERIC_SUFFIX_BEHAVIOR.md](./NUMERIC_SUFFIX_BEHAVIOR.md).

**Key behavior:**
- ✅ Base name searches find ALL suffix variants
- ✅ Nickname matching works across suffixes
- ✅ Exact matches always work
- ⚠️ Suffix-specific searches may not find base cases (minor edge case)
