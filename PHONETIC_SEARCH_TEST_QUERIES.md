# Quick Reference: Phonetic Search Test Queries

Copy-paste these queries to test phonetic search functionality.

## Core Phonetic Matching
```
jon
john
jonathan
jane (should NOT match jon/john)
```

## Nickname Matching
```
mike
michael
bob
robert
bill
william
jim
james
dick
richard
```

## Phonetic Variations (Previously Lost)
```
gail
gayle
cathy
kathy
katherine
stephen
stephen
steven
kristin
kristen
kirsten
kirstin
shawn
sean
sara
sarah
```

## International Names

### Spanish/Latino
```
jose
maria
garcia
hernandez
rodriguez
```

### Eastern European
```
kowalski
novak
ivanova
petrovic
muller
```

### East Asian
```
li wei
wang
kim
tanaka
nguyen
```

### Arabic/Middle Eastern
```
mohammed
muhammad
hassan
fatima
abdullah
```

## Edge Cases

### Very Short (2 chars)
```
wu
li
yi
bo
ed
al
```

### With Stop Words
```
mary and joseph smith
john or jane
company in new york
```

### With Numbers
```
john smith iii
7-eleven
route 66
```

### Special Characters
```
o'brien
smith-jones
mc donald
```

### Multi-Cultural
```
jose o'brien martinez
li wei johnson
anna maria schmidt
```

### Formatting
```
SMITH (all caps)
smith  jones (extra spaces)
smith--jones (multiple hyphens)
```

## Prefix Matching
```
jon (should find Johnson, Jones)
wil (should find William, Wilson, Williams)
mar (should find Martin, Martinez, Marshall, Mary)
```

## Multi-Word
```
john smith
michael johnson
smith (should find all Smiths)
```

## False Positives (Should NOT Match)
```
mike (should NOT find Maxwell, Mitchell without qualification)
jon (should NOT find Jane, Jason)
```

## Test Summary

**Total Test Cases:** 190
**Court Division:** 081 (Manhattan)
**Case Pattern:** 00-XXXXX
**Status:** All open (no closedDate)

**Cleanup Command:**
```bash
npx tsx backend/lib/testing/phonetic-search-data-management.ts cleanup
```
