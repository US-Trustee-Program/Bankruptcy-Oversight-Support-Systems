package gov.doj.ustp;

public class SqlQueryConstants {
  public static final String PROF_CODE_QUERY =
      "SELECT "
          + "PROF_FIRST_NAME, "
          + "PROF_MI, "
          + "PROF_LAST_NAME, "
          + "UST_PROF_CODE "
          + "FROM [dbo].[CMMPR] "
          + "WHERE DELETE_CODE <> 'D' "
          + "AND PROF_FIRST_NAME = ? AND PROF_LAST_NAME = ?";

  public static final String CASE_LIST_QUERY =
      "SELECT debtor.CURR_CASE_CHAPT, CONCAT(debtor.CASE_YEAR, '-', debtor.CASE_NUMBER) AS"
          + " 'CASE_YEAR_AND_NUMBER', debtor.DEBTOR1_NAME, debtor.CURRENT_CHAPTER_FILE_DATE,"
          + " RTRIM(professional1.PROF_FIRST_NAME) + ' ' + RTRIM(professional1.PROF_LAST_NAME) AS"
          + " 'STAFF1_PROF_NAME', professionalTypes1.PROF_TYPE_DESC AS 'STAFF1_PROF_TYPE_DESC',"
          + " RTRIM(professional2.PROF_FIRST_NAME) + ' ' + RTRIM(professional2.PROF_LAST_NAME) AS"
          + " 'STAFF2_PROF_NAME', professionalTypes2.PROF_TYPE_DESC AS 'STAFF2_PROF_TYPE_DESC',"
          + " ISNULL(hearingsHistory.HEARING_DATE, 0) AS 'HEARING_DATE',"
          + " ISNULL(hearingsHistory.HEARING_TIME, 0) AS 'HEARING_TIME',"
          + " ISNULL(hearingsHistory.HEARING_CODE, '') AS 'HEARING_CODE',"
          + " ISNULL(hearingsHistory.HEARING_DISP, '') AS 'HEARING_DISP' FROM [dbo].[CMMDB] debtor"
          + " LEFT OUTER JOIN [dbo].[CMMPR] professional1 ON debtor.GROUP_DESIGNATOR ="
          + " professional1.GROUP_DESIGNATOR AND debtor.STAFF1_PROF_CODE ="
          + " professional1.UST_PROF_CODE LEFT OUTER JOIN [dbo].[CMMPR] professional2 ON"
          + " debtor.GROUP_DESIGNATOR = professional2.GROUP_DESIGNATOR AND debtor.STAFF2_PROF_CODE"
          + " = professional2.UST_PROF_CODE INNER JOIN [dbo].[CMMPT] professionalTypes1 ON"
          + " debtor.GROUP_DESIGNATOR = professionalTypes1.GROUP_DESIGNATOR AND"
          + " professional1.PROF_TYPE = professionalTypes1.PROF_TYPE INNER JOIN [dbo].[CMMPT]"
          + " professionalTypes2 ON debtor.GROUP_DESIGNATOR = professionalTypes2.GROUP_DESIGNATOR"
          + " AND professional2.PROF_TYPE = professionalTypes2.PROF_TYPE LEFT OUTER JOIN"
          + " [dbo].[CMHHR] hearingsHistory ON debtor.CASE_DIV = hearingsHistory.CASE_DIV AND"
          + " debtor.CASE_YEAR = hearingsHistory.CASE_YEAR AND debtor.CASE_NUMBER ="
          + " hearingsHistory.CASE_NUMBER AND hearingsHistory.HEARING_CODE = 'IDI' WHERE"
          + " debtor.DELETE_CODE != 'D' AND debtor.CLOSED_BY_COURT_DATE = 0 AND"
          + " debtor.CLOSED_BY_UST_DATE = 0 AND debtor.TRANSFERRED_OUT_DATE = 0 AND"
          + " debtor.DISMISSED_DATE = 0 AND debtor.CURR_CASE_CHAPT = ? AND (debtor.STAFF1_PROF_CODE"
          + " = ? OR debtor.STAFF2_PROF_CODE = ?)";
}
