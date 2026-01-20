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
