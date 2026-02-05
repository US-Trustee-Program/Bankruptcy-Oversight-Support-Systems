# Manual Phonetic Search Testing Checklist

## Overview
This checklist covers all phonetic search features and edge cases using the 190 test cases seeded in the database.

All test cases use:
- Court Division: **081** (Manhattan)
- Case Number Pattern: **00-XXXXX**
- Status: **Open** (no closedDate)

---

## 1. Core Phonetic Matching

### Jon/John Variations
- [ ] Search **"jon"** → Should find:
  - Jon Smith
  - John Smith
  - Jonathan Williams
  - John Davis
  - Jon Martinez
  - Johnson (character prefix match)
  - Jones (character prefix match)

- [ ] Search **"john"** → Should find same cases as "jon"

- [ ] Search **"jonathan"** → Should find:
  - Jonathan Williams
  - John (exact match on "john" within "jonathan")

### Jane/Jon (Should NOT Match - False Positive Test)
- [ ] Search **"jane"** → Should NOT find Jon/John cases
- [ ] Search **"jon"** → Should NOT find Jane cases

---

## 2. Nickname Matching

### Mike/Michael
- [ ] Search **"mike"** → Should find:
  - Michael Johnson
  - Mike Johnson
  - Michael Brown
  - Mike Williams
  - Michael Anderson

- [ ] Search **"michael"** → Should find same cases as "mike"

### Bob/Robert
- [ ] Search **"bob"** → Should find:
  - Robert Miller
  - Bob Davis
  - Bobby Wilson
  - Robert Johnson

- [ ] Search **"robert"** → Should find same cases as "bob"

### Bill/William
- [ ] Search **"bill"** → Should find:
  - William Brown
  - Bill Garcia
  - Billy Martinez

- [ ] Search **"william"** → Should find same cases as "bill"

### Jim/James
- [ ] Search **"jim"** → Should find:
  - James Miller
  - Jim Anderson
  - Jimmy Davis

- [ ] Search **"james"** → Should find same cases as "jim"

### Dick/Richard
- [ ] Search **"dick"** → Should find:
  - Richard Davis
  - Dick Wilson

- [ ] Search **"richard"** → Should find same cases as "dick"

---

## 3. Phonetic Variations (Previously Lost with Soundex)

### Gail/Gayle
- [ ] Search **"gail"** → Should find:
  - Gail Johnson
  - Gayle Thompson

- [ ] Search **"gayle"** → Should find same cases as "gail"

### Cathy/Kathy/Katherine
- [ ] Search **"cathy"** → Should find:
  - Cathy Williams
  - Kathy Martinez
  - Katherine Davis

- [ ] Search **"kathy"** → Should find same cases as "cathy"

- [ ] Search **"katherine"** → Should find same cases as "cathy"

### Stephen/Stephan/Steven
- [ ] Search **"stephen"** → Should find:
  - Stephen Brown
  - Stephan Miller
  - Steven Garcia

- [ ] Search **"steven"** → Should find same cases as "stephen"

### Kristin Variations
- [ ] Search **"kristin"** → Should find:
  - Kristin Rodriguez
  - Kristen Wilson
  - Kirsten Anderson
  - Kirstin Thomas

- [ ] Search **"kristen"** → Should find same cases as "kristin"

### Shawn/Sean
- [ ] Search **"shawn"** → Should find:
  - Shawn Jackson
  - Sean Moore

- [ ] Search **"sean"** → Should find same cases as "shawn"

### Sara/Sarah
- [ ] Search **"sara"** → Should find:
  - Sara Martin
  - Sarah Taylor

- [ ] Search **"sarah"** → Should find same cases as "sara"

---

## 4. International Names

### Spanish/Latino Names
- [ ] Search **"jose"** → Should find:
  - José García
  - Jose Rodriguez

- [ ] Search **"maria"** → Should find:
  - María López
  - Maria Hernández

- [ ] Search **"garcia"** → Should find García cases

- [ ] Search **"hernandez"** → Should find Hernández cases

- [ ] Search **"rodriguez"** → Should find Rodríguez cases

### Eastern European Names
- [ ] Search **"kowalski"** → Should find Kowalski cases

- [ ] Search **"novak"** → Should find Novák cases

- [ ] Search **"ivanova"** → Should find Ivanova cases

- [ ] Search **"petrovic"** → Should find Petrović cases

- [ ] Search **"muller"** → Should find Müller cases

### East Asian Names
- [ ] Search **"li wei"** → Should find Li Wei cases

- [ ] Search **"wang"** → Should find Wang Fang cases

- [ ] Search **"kim"** → Should find Kim Min-jun cases

- [ ] Search **"tanaka"** → Should find Tanaka Yuki cases

- [ ] Search **"nguyen"** → Should find Nguyen Van Anh cases

### Arabic/Middle Eastern Names
- [ ] Search **"mohammed"** → Should find:
  - Yusuf Muhammad Kareem
  - Mohammed variants

- [ ] Search **"muhammad"** → Should find same as "mohammed"

- [ ] Search **"hassan"** → Should find Hassan cases

- [ ] Search **"fatima"** → Should find Fatima cases

- [ ] Search **"abdullah"** → Should find Abdullah cases

---

## 5. Edge Cases

### Very Short Names (2 characters)
- [ ] Search **"wu"** → Should find Wu cases

- [ ] Search **"li"** → Should find Li cases

- [ ] Search **"yi"** → Should find Yi cases

- [ ] Search **"bo"** → Should find Bo cases

- [ ] Search **"ed"** → Should find Ed cases

- [ ] Search **"al"** → Should find Al cases

### Names with Stop Words
- [ ] Search **"mary and joseph smith"** → Should find:
  - Mary And Joseph Smith (full match)
  - Mary Smith (partial match)
  - Joseph Smith (partial match)

- [ ] Search **"john or jane"** → Should find John OR Jane cases

- [ ] Search **"company in new york"** → Should find relevant cases

### Names with Numbers
- [ ] Search **"john smith iii"** → Should find:
  - John Smith III
  - John Smith (without suffix)

- [ ] Search **"7-eleven"** → Should find 7-Eleven Corporation

- [ ] Search **"route 66"** → Should find Route 66 Diner

### Names with Special Characters
- [ ] Search **"o'brien"** → Should find:
  - O'Brien cases
  - OBrien cases (with/without apostrophe)

- [ ] Search **"smith-jones"** → Should find hyphenated names

- [ ] Search **"mc donald"** → Should find McDonald cases

### Complex Multi-Cultural Names
- [ ] Search **"jose o'brien martinez"** → Should find José O'Brien-Martinez

- [ ] Search **"li wei johnson"** → Should find Li Wei-Johnson

- [ ] Search **"anna maria schmidt"** → Should find Anna-Maria Schmidt

### Unusual Formatting
- [ ] Search **"SMITH"** → Should find Smith (case-insensitive)

- [ ] Search **"smith  jones"** → Should find "Smith Jones" (extra spaces)

- [ ] Search **"smith--jones"** → Should find "Smith-Jones" (multiple hyphens)

---

## 6. Character Prefix Matching

### Short Query Matches Longer Names
- [ ] Search **"jon"** → Should find:
  - Jon (exact)
  - Johnson (prefix)
  - Jones (prefix)
  - Jonathan (prefix)

- [ ] Search **"wil"** → Should find:
  - William
  - Wilson
  - Williams

- [ ] Search **"mar"** → Should find:
  - Martin
  - Martinez
  - Marshall
  - Mary

---

## 7. Multi-Word Search

### First + Last Name
- [ ] Search **"john smith"** → Should find:
  - John Smith (exact)
  - Jon Smith (phonetic on "john")
  - John Johnson (partial match on "john")

- [ ] Search **"michael johnson"** → Should find:
  - Michael Johnson (exact)
  - Mike Johnson (nickname on "michael")

### Full Name vs Partial
- [ ] Search **"john"** → Should return MORE results than "john smith"

- [ ] Search **"smith"** → Should return ALL Smiths regardless of first name

---

## 8. Scoring/Ranking Verification

### Exact Match Should Rank Highest
- [ ] Search **"john smith"** → Verify "John Smith" appears BEFORE:
  - Jon Smith (phonetic match)
  - Johnson Smith (prefix match)
  - John Jones (partial match)

### Nickname Should Rank High
- [ ] Search **"mike"** → Verify "Mike X" ranks HIGHER than:
  - Mitchell (phonetic only)
  - Maxwell (phonetic only)

### Phonetic Should Rank Lower Than Exact
- [ ] Search **"jon"** → Verify ranking order:
  1. Jon Smith (exact)
  2. John Smith (phonetic + exact)
  3. Jonathan Williams (phonetic + prefix)
  4. Johnson (character prefix)

---

## 9. False Positive Tests (Should NOT Match)

### Avoid Over-Matching
- [ ] Search **"mike"** → Should NOT find:
  - Maxwell (phonetic M530 but no qualifier)
  - Mitchell (phonetic MXHL but no qualifier)
  - Smith (no phonetic overlap)

- [ ] Search **"jon"** → Should NOT find:
  - Jane (different phonetic)
  - Jason (different phonetic)

---

## 10. Performance Tests

### Large Result Sets
- [ ] Search **"smith"** → Should return results quickly (< 2 seconds)

- [ ] Search **"john"** → Should handle many matches efficiently

### Single Letter (Should Reject or Handle Gracefully)
- [ ] Search **"j"** → Verify behavior (should it search or require more characters?)

---

## Expected Behavior Summary

### Match Types (Priority Order)
1. **Exact Match (10,000 pts)** - "John" finds "John"
2. **Nickname Match (1,000 pts)** - "Mike" finds "Michael"
3. **Qualified Phonetic (100 pts)** - "Jon" finds "John" (same Metaphone + exact/prefix qualifier)
4. **Character Prefix (75 pts)** - "Jon" finds "Johnson"

### Key Rules
- Phonetic matches REQUIRE qualification (exact, nickname, or prefix match on another word)
- Character prefix matching helps find longer names (Jon → Johnson)
- Case-insensitive search
- Stop words (and, or, in) are preserved in matching
- Multi-word queries match across first/last names

---

## Test Data Cleanup

When done testing:
```bash
npx tsx backend/lib/testing/phonetic-search-data-management.ts cleanup
```

This removes all 190 test cases (identified by caseNumber starting with "00-").
