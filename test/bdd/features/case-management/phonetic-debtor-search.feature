Feature: Phonetic Debtor Name Search
  As a USTP staff member
  I want to search for cases by debtor name with phonetic matching
  So that I can find cases even with name variations, misspellings, or nicknames

  Background:
    Given the following test cases exist in the system:
      | caseId         | debtorName        | jointDebtorName   | phoneticTokens                    |
      | 081-24-00001   | Michael Johnson   |                   | ["M240", "MXL", "J525", "JNSN"]  |
      | 081-24-00002   | Mike Johnson      |                   | ["M200", "MK", "J525", "JNSN"]   |
      | 081-24-00007   | Jon Smith         |                   | ["J500", "JN", "S530", "SM0"]    |
      | 081-24-00008   | John Smith        |                   | ["J500", "JN", "S530", "SM0"]    |
      | 081-24-00012   | Jane Doe          |                   | ["J500", "JN", "D000", "T"]      |
      | 081-24-00062   | Muhammad Ali      |                   | ["M530", "MHMT", "A400", "AL"]   |
      | 081-24-00063   | Mohammed Ali      |                   | ["M530", "MHMT", "A400", "AL"]   |

  @nickname-matching
  Scenario: Search with common nicknames
    When I search for debtor name "Mike"
    Then I should see cases for both "Michael Johnson" and "Mike Johnson"
    And the results should include case IDs "081-24-00001" and "081-24-00002"

  @phonetic-matching
  Scenario: Search with phonetically similar names
    When I search for debtor name "Jon"
    Then I should see cases for both "Jon Smith" and "John Smith"
    And the results should include case IDs "081-24-00007" and "081-24-00008"
    But the results should NOT include "Jane Doe" (case ID "081-24-00012")

  @partial-matching
  Scenario: Search with partial names
    When I search for debtor name "john sm"
    Then I should see cases containing "John Smith"
    And each word should match as a prefix of the actual name

  @case-insensitive
  Scenario: Search is case-insensitive
    When I search for debtor name "MICHAEL JOHNSON"
    Then I should see the same results as searching for "michael johnson"

  @joint-debtor
  Scenario: Search includes joint debtor names
    Given a case exists with joint debtor "Sarah Connor"
    When I search for debtor name "Sarah Connor"
    Then I should see the case with the joint debtor match

  @international-names
  Scenario Outline: Search handles international name variations
    When I search for debtor name "<searchName>"
    Then I should see cases with names matching "<expectedNames>"

    Examples:
      | searchName | expectedNames                    |
      | Muhammad   | Muhammad Ali, Mohammed Ali       |
      | Jose       | Jose Garcia, Joseph Garcia       |
      | Wong       | Wong, Wang (if similarity >= 0.83) |

  @performance
  Scenario: Search completes within acceptable time
    Given the database contains 1,000,000 cases
    When I search for debtor name "Smith"
    Then the search should complete within 250 milliseconds
    And the results should be limited to the first 100 matches

  @fallback-to-regex
  Scenario: System falls back to regex search if phonetic search is disabled
    Given phonetic search is disabled in configuration
    When I search for debtor name "Michael"
    Then I should only see exact substring matches for "Michael"
    And I should NOT see results for "Mike"

  # Edge Cases and Error Handling

  @edge-case
  Scenario: Empty search query returns no results
    When I search for debtor name ""
    Then I should see a message indicating search criteria is required
    And no results should be displayed

  @edge-case
  Scenario: Whitespace-only search query is treated as empty
    When I search for debtor name "   "
    Then I should see a message indicating search criteria is required
    And no results should be displayed

  @special-characters
  Scenario: Names with apostrophes and hyphens are handled correctly
    Given cases exist with names "O'Brien", "O'Brian", and "OBrien"
    When I search for debtor name "O'Brien"
    Then I should see all variations including "O'Brien", "O'Brian", and "OBrien"

  @special-characters
  Scenario: Names with hyphens match correctly
    Given cases exist with names "Mary-Jane Smith" and "Mary Jane Smith"
    When I search for debtor name "Mary-Jane"
    Then I should see both "Mary-Jane Smith" and "Mary Jane Smith"

  @unicode-characters
  Scenario: Names with accented characters are normalized
    Given cases exist with names "José Garcia" and "Jose Garcia"
    When I search for debtor name "Jose"
    Then I should see both "José Garcia" and "Jose Garcia"

  @unicode-characters
  Scenario: Names with umlauts are handled
    Given a case exists with name "Müller"
    When I search for debtor name "Muller"
    Then I should see the case with "Müller"

  @long-names
  Scenario: Very long names are handled correctly
    Given a case exists with a 100-character long debtor name
    When I search for the first 20 characters of that name
    Then I should see the case with the long name
    And the search should complete within performance threshold

  @single-character
  Scenario: Single character search returns limited results
    When I search for debtor name "J"
    Then I should see results limited to prevent overwhelming the system
    And the results should be the most relevant matches

  @duplicate-names
  Scenario: Duplicate names across different cases are all returned
    Given 5 cases exist with debtor name "John Smith"
    When I search for debtor name "John Smith"
    Then I should see all 5 cases in the results
    And they should be distinguishable by case ID

  @multiple-spaces
  Scenario: Multiple spaces in search query are normalized
    When I search for debtor name "John    Smith"
    Then I should see the same results as searching for "John Smith"

  @name-with-title
  Scenario: Names with titles are matched without titles
    Given a case exists with debtor name "Dr. John Smith"
    When I search for debtor name "John Smith"
    Then I should see the case with "Dr. John Smith"

  @no-vowels
  Scenario: Names with consonant clusters work phonetically
    Given cases exist with names "Schwartz" and "Swartz"
    When I search for debtor name "Schwartz"
    Then I should see both "Schwartz" and "Swartz"

  @similarity-threshold
  Scenario: Names below similarity threshold are excluded
    Given a case exists with name "Johnson"
    When I search for debtor name "Jackson"
    Then I should NOT see "Johnson" in results
    Because the similarity score is below the threshold

  @query-longer-than-names
  Scenario: Search query longer than any name in database
    Given cases exist with short names
    When I search for debtor name "ThisIsAVeryLongNameThatDoesNotExistAnywhere"
    Then I should see a "No cases found" message
