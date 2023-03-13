package gov.doj;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.HashMap;
import java.util.Map;

public class CMMDBLoader extends AbstractDataLoader implements IDataLoader {

  protected ConnectionManager connectionManager;

  private final Map<String, Integer> federalIdMap = new HashMap<>();
  private int federalId = 20230001;

  public CMMDBLoader() {
    connectionManager = new ConnectionManager();
  }

  @Override
  public void run() {
    clearTable();
    loadTable();
  }

  @Override
  public void initialize(String filePath) {
    setCsvFilePath(filePath);
  }

  @Override
  public void loadTable() {
    String sql =
        "SET IDENTITY_INSERT dbo.CMMDB ON;INSERT INTO dbo.CMMDB"
            + " (DELETE_CODE,CASE_DIV,CASE_YEAR,CASE_NUMBER,BLANK_04,CONSOLIDATION_DATE,ENTRY_DATE,CONSOLIDATED_CASE_NUMBER,COURT_CASE_NUMBER,CURR_CASE_CHAPT,CURRENT_CHAPTER_FILE_DATE,DEBTOR_TYPE,DEBTOR1_FEDERAL_ID,BLANK_06,DEBTOR1_SOC_SEC_NUM,DEBTOR1_NAME,DEBTOR_ADDRESS1,DEBTOR_ADDRESS2,DEBTOR_CITY,DEBTOR_STATE,DEBTOR_ZIP_CODE,CASE_FILED_DATE,STAFF1_PROF_CODE,STAFF2_PROF_CODE,DEBTOR_ATTORNEY,TRUSTEE_ASSIGNED,TRUSTEE_APPT_DATE,INCREMENT_BOND_AMOUNT,BOND_EXPIRATION_DATE,JUDGE_ASSIGNED,CLOSED_BY_UST_DATE,CLOSED_BY_COURT_DATE,TRANSFERRED_OUT_DATE,RELIEF_DATE,NUMBER_OF_CREDITORS,PETITION_TYPE,SENT_TO_ARCHIVE_DATE,DISMISSED_DATE,DISCHARGED_DATE,SCHEDULES_COMPLETE_YN,CHAPTER_WHEN_FILED,PREVIOUS_CASE_CHAPTER,PREVIOUS_CHAPTER_DATE,LAST_CHANGE_DATE,PRIORITY_DEBT_AMOUNT,SECURED_DEBT_AMOUNT,UNSECURED_DEBT_AMOUNT,INSURANCE_AMOUNT,INSURANCE_EXPIRE_DATE,TOTAL_VALUE_ASSETS,EXEMPTION_AMOUNT,ABANDONMENTS_AMOUNT,ADJUSTMENTS_NEGATIVE,ADJUSTMENTS_POSITIVE,TRUST_ADMINISTRATION_COST,UNDISTRIBUTED_FUND_AMOUNT,DISTRIBUTION_FUND_AMOUNT,UNLIQUID_ASSETS,ESTATE_AMOUNT_REPORTED,BANK1_ABBREV,BANK1_AMOUNT,BANK2_ABBREV,BANK2_AMOUNT,BANK3_ABBREV,BANK3_AMOUNT,SEPARATE_BOND_AMOUNT,CREDITOR_COMM_REPORTED,LAST_REPORT_CODE,LAST_REPORT_DATE,CONSOLIDATION_TYPE,COUNTRY,DEBT_ATTORNEY_APPOINT_DATE,CERTIFIED_DISMISSAL_DATE,BOND_EFFECTIVE_DATE,BOND_COMPANY_CD,ESTIMATED_TFR_DATE,BLANK_04_B,RELATED_CASE_YN,REGION_CODE,GROUP_DESIGNATOR,RGN_CREATE_DATE,RGN_UPDATE_DATE,CDB_CREATE_DATE,CDB_UPDATE_DATE,CONSOLIDATION_DATE_DT,ENTRY_DATE_DT,CURRENT_CHAPTER_FILE_DATE_DT,CASE_FILED_DATE_DT,TRUSTEE_APPT_DATE_DT,BOND_EXPIRATION_DATE_DT,CLOSED_BY_UST_DATE_DT,CLOSED_BY_COURT_DATE_DT,TRANSFERRED_OUT_DATE_DT,RELIEF_DATE_DT,SENT_TO_ARCHIVE_DATE_DT,DISMISSED_DATE_DT,DISCHARGED_DATE_DT,PREVIOUS_CHAPTER_DATE_DT,INSURANCE_EXPIRE_DATE_DT,LAST_REPORT_DATE_DT,DEBT_ATTORNEY_APPOINT_DATE_DT,CERTIFIED_DISMISSAL_DATE_DT,BOND_EFFECTIVE_DATE_DT,ESTIMATED_TFR_DATE_DT,RGN_CREATE_DATE_DT,RGN_UPDATE_DATE_DT,CDB_CREATE_DATE_DT,CDB_UPDATE_DATE_DT,CASE_FULL_ACMS,UPDATE_DATE,REPLICATED_DATE,LAST_CHANGE_DATE_DT,id,RRN)"
            + " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

    Connection connection = this.connectionManager.getConnection();

    try (BufferedReader lineReader = new BufferedReader(new FileReader(getCsvFilePath()))) {
      PreparedStatement statement = connection.prepareStatement(sql);

      int count = 0;
      String lineText = null;

      lineReader.readLine(); // skip the header line

      while ((lineText = lineReader.readLine()) != null) {
        int index = 0;
        String[] data = lineText.split(",");
        SqlStatementHelper.setCharString(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setCharString(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setLong(index, data[index++], statement);
        SqlStatementHelper.setCharString(index, data[index++], statement);
        SqlStatementHelper.setCharString(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setCharString(index, data[index++], statement);
        SqlStatementHelper.setInt(index, numericizeFederalId(data[index++]), statement);
        SqlStatementHelper.setCharString(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setCharString(index, data[index++], statement);
        SqlStatementHelper.setCharString(index, SqlStatementHelper.maxChars(data[index++], 30), statement);
        SqlStatementHelper.setCharString(index, data[index++], statement);
        SqlStatementHelper.setCharString(index, SqlStatementHelper.maxChars(data[index++], 20), statement);
        SqlStatementHelper.setCharString(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setDouble(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setDouble(index, data[index++], statement);
        SqlStatementHelper.setCharString(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setCharString(index, data[index++], statement);
        SqlStatementHelper.setCharString(index, data[index++], statement);
        SqlStatementHelper.setCharString(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setDouble(index, data[index++], statement);
        SqlStatementHelper.setDouble(index, data[index++], statement);
        SqlStatementHelper.setDouble(index, data[index++], statement);
        SqlStatementHelper.setDouble(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setDouble(index, data[index++], statement);
        SqlStatementHelper.setDouble(index, data[index++], statement);
        SqlStatementHelper.setDouble(index, data[index++], statement);
        SqlStatementHelper.setDouble(index, data[index++], statement);
        SqlStatementHelper.setDouble(index, data[index++], statement);
        SqlStatementHelper.setDouble(index, data[index++], statement);
        SqlStatementHelper.setDouble(index, data[index++], statement);
        SqlStatementHelper.setDouble(index, data[index++], statement);
        SqlStatementHelper.setDouble(index, data[index++], statement);
        SqlStatementHelper.setDouble(index, data[index++], statement);
        SqlStatementHelper.setCharString(index, data[index++], statement);
        SqlStatementHelper.setDouble(index, data[index++], statement);
        SqlStatementHelper.setCharString(index, data[index++], statement);
        SqlStatementHelper.setDouble(index, data[index++], statement);
        SqlStatementHelper.setCharString(index, data[index++], statement);
        SqlStatementHelper.setDouble(index, data[index++], statement);
        SqlStatementHelper.setDouble(index, data[index++], statement);
        SqlStatementHelper.setCharString(index, data[index++], statement);
        SqlStatementHelper.setCharString(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setCharString(index, data[index++], statement);
        SqlStatementHelper.setCharString(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setCharString(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setCharString(index, data[index++], statement);
        SqlStatementHelper.setCharString(index, data[index++], statement);
        SqlStatementHelper.setCharString(index, data[index++], statement);
        SqlStatementHelper.setCharString(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setTimestamp(index, data[index++], statement);
        SqlStatementHelper.setTimestamp(index, data[index++], statement);
        SqlStatementHelper.setTimestamp(index, data[index++], statement);
        SqlStatementHelper.setTimestamp(index, data[index++], statement);
        SqlStatementHelper.setTimestamp(index, data[index++], statement);
        SqlStatementHelper.setTimestamp(index, data[index++], statement);
        SqlStatementHelper.setTimestamp(index, data[index++], statement);
        SqlStatementHelper.setTimestamp(index, data[index++], statement);
        SqlStatementHelper.setTimestamp(index, data[index++], statement);
        SqlStatementHelper.setTimestamp(index, data[index++], statement);
        SqlStatementHelper.setTimestamp(index, data[index++], statement);
        SqlStatementHelper.setTimestamp(index, data[index++], statement);
        SqlStatementHelper.setTimestamp(index, data[index++], statement);
        SqlStatementHelper.setTimestamp(index, data[index++], statement);
        SqlStatementHelper.setTimestamp(index, data[index++], statement);
        SqlStatementHelper.setTimestamp(index, data[index++], statement);
        SqlStatementHelper.setTimestamp(index, data[index++], statement);
        SqlStatementHelper.setTimestamp(index, data[index++], statement);
        SqlStatementHelper.setTimestamp(index, data[index++], statement);
        SqlStatementHelper.setTimestamp(index, data[index++], statement);
        SqlStatementHelper.setTimestamp(index, data[index++], statement);
        SqlStatementHelper.setTimestamp(index, data[index++], statement);
        SqlStatementHelper.setTimestamp(index, data[index++], statement);
        SqlStatementHelper.setTimestamp(index, data[index++], statement);
        SqlStatementHelper.setVarCharString(index, data[index++], statement);
        SqlStatementHelper.setTimestamp(index, data[index++], statement);
        SqlStatementHelper.setTimestamp(index, data[index++], statement);
        SqlStatementHelper.setTimestamp(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);
        SqlStatementHelper.setInt(index, data[index++], statement);

        boolean rowInserted = statement.executeUpdate() > 0;

        count++;
      }
    } catch (IOException | SQLException e) {
      throw new RuntimeException(e);
    }
  }

  private String numericizeFederalId(String hash) {
    if (federalIdMap.containsKey(hash)) {
      return federalIdMap.get(hash).toString();
    } else {
      System.out.println("Hash " + hash + " mapped to " + federalId + ".");
      federalIdMap.put(hash, federalId++);
      return federalIdMap.get(hash).toString();
    }
  }

  @Override
  public void clearTable() {
    try (Connection connection = getConnection()) {

      String truncateSql = "TRUNCATE TABLE dbo.CMMDB";
      Statement statement = connection.createStatement();
      statement.executeUpdate(truncateSql);

    } catch (SQLException e) {
      e.printStackTrace();
    }}
}
