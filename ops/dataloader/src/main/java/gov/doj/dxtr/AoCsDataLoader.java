package gov.doj.dxtr;

import gov.doj.AbstractDataLoader;
import gov.doj.ConnectionManager;
import gov.doj.IDataLoader;
import java.io.BufferedReader;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Arrays;

public class AoCsDataLoader extends AbstractDataLoader implements IDataLoader {

  private static final String TABLE_NAME = "dbo.AO_CS";

  private static final String INSERT_SQL =
      new StringBuilder()
          .append("SET IDENTITY_INSERT dbo.AO_CS ON;")
          .append(
              "INSERT INTO dbo.AO_CS ([CS_CASEID], [COURT_ID], [CS_CASE_NUMBER], [CS_DIV],"
                  + " [GRP_DES], [CASE_ID], [CS_SHORT_TITLE], [CS_CLOSED], [CS_CHAPTER],"
                  + " [CS_JOINT], [CS_TYPE], [CS_FEE_STATUS], [CS_PREV_CHAPTER], [CS_VOL_INVOL],"
                  + " [CS_DATE_FILED], [CS_DATE_CONVERT], [CS_REOPEN_CODE], [CS_DATE_REOPEN],"
                  + " [CS_DATE_TERM], [CS_DATE_DISCHARGE], [CS_DATE_DISMISS], [BK_ASSET_NOTICE],"
                  + " [CS_COUNTY], [CF_VALUE], [CS_DISP_METHOD], [JD_LAST_NAME], [JD_MIDDLE_NAME],"
                  + " [JD_FIRST_NAME], [LAST_DATE_ENTER], [JD_EVENT], [CASE_NUMBER_EVENT],"
                  + " [DATE_FILED_EVENT], [CS_DISP_JT_METHOD], [BK_NATURE_business_event],"
                  + " [BK_SMALL_BUS_EVENT], [BK_AGR_LIQ_DEBT_TWO_MIL_EVENT],"
                  + " [BK_PREPACKAGED_EVENT], [BK_PRIOR_FILING_EVENT], [PP_EVENT], [sfi_event],"
                  + " [sfc_event], [ST6_event], [ST6_WD_event], [cs_subchapter],"
                  + " [cs_subchapter_event], [SPV_event], [SPN_event])")
          .append(
              "VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,"
                  + " ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .toString();

  public AoCsDataLoader() {
    setLoaderName("AO_CS");
  }

  @Override
  public void initialize(String csvFilePath) {
    setCsvFilePath(csvFilePath);
  }

  @Override
  public void run() {
    // clear the table
    clearTable();

    // Load up the data
    loadTable();

    // Cleanup
  }

  @Override
  public void loadTable() {
    Connection connection = null;
    try (BufferedReader lineReader = new BufferedReader(new FileReader(getCsvFilePath()))) {
      connection = ConnectionManager.getInstance().getAODATEXConnection();
      PreparedStatement statement = connection.prepareStatement(this.INSERT_SQL);

      int count = 0;
      String lineText = null;

      lineReader.readLine(); // skip the header line

      while ((lineText = lineReader.readLine()) != null) {

        String[] data = lineText.split(",");
        System.out.println("data:" + Arrays.toString(data));
        setValuesToInsert(statement, data);
        boolean rowInserted = statement.executeUpdate() > 0;

        count++;
        System.out.println("RowInserted : " + rowInserted + ". Row Number : " + count);
      }

    } catch (FileNotFoundException e) {
      throw new RuntimeException(e);
    } catch (IOException | SQLException e) {
      throw new RuntimeException(e);
    } finally {
      try {
        if (connection != null) connection.close();
      } catch (Exception e) {
        e.printStackTrace();
      }
    }
  }

  private void setValuesToInsert(PreparedStatement statement, String[] data) throws SQLException {
    statement.setString(1, data[0]); // CS_CASEID
    statement.setString(2, data[1]); // COURT_ID
    statement.setString(3, data[2]); // CS_CASE_NUMBER
    statement.setString(4, data[3]); // CS_DIV
    statement.setString(5, data[4]); // GRP_DES
    statement.setString(6, data[5]); // CASE_ID
    statement.setString(7, data[6]); // CS_SHORT_TITLE
    statement.setString(8, data[7]); // CS_CLOSED
    statement.setString(9, data[8]); // CS_CHAPTER
    statement.setString(10, data[9]); // CS_JOINT
    statement.setString(11, data[10]); // CS_TYPE
    statement.setString(12, data[11]); // CS_FEE_STATUS
    statement.setString(13, data[12]); // CS_PREV_CHAPTER
    statement.setString(14, data[13]); // CS_VOL_INVOL

    this.setTimestamp(15, data[14], statement); // CS_DATE_FILED
    this.setTimestamp(16, data[15], statement); // CS_DATE_CONVERT

    statement.setString(17, data[16]); // CS_REOPEN_CODE

    this.setTimestamp(18, data[17], statement); // CS_DATE_REOPEN
    this.setTimestamp(19, data[18], statement); // CS_DATE_TERM
    this.setTimestamp(20, data[19], statement); // CS_DATE_DISCHARGE
    this.setTimestamp(21, data[20], statement); // CS_DATE_DISMISS

    statement.setString(22, data[21]); // BK_ASSET_NOTICE
    statement.setString(23, data[22]); // CS_COUNTY
    statement.setString(24, data[23]); // CF_VALUE
    statement.setString(25, data[24]); // CS_DISP_METHOD
    statement.setString(26, data[25]); // JD_LAST_NAME
    statement.setString(27, data[26]); // JD_MIDDLE_NAME
    statement.setString(28, data[27]); // JD_FIRST_NAME

    this.setTimestamp(29, data[28], statement); // LAST_DATE_ENTER

    statement.setString(30, data[29]); // JD_EVENT
    statement.setString(31, data[30]); // CASE_NUMBER_EVENT
    statement.setString(32, data[31]); // DATE_FILED_EVENT
    statement.setString(33, data[32]); // CS_DISP_JT_METHOD
    statement.setString(34, data[33]); // BK_NATURE_business_event
    statement.setString(35, data[34]); // BK_SMALL_BUS_EVENT
    statement.setString(36, data[35]); // BK_AGR_LIQ_DEBT_TWO_MIL_EVENT
    statement.setString(37, data[36]); // BK_PREPACKAGED_EVENT
    statement.setString(38, data[37]); // BK_PRIOR_FILING_EVENT
    statement.setString(39, data[38]); // PP_EVENT
    statement.setString(40, data[39]); // sfi_event
    statement.setString(41, data[40]); // sfc_event
    statement.setString(42, data[41]); // ST6_event
    statement.setString(43, data[42]); // ST6_WD_event
    statement.setString(44, data[43]); // cs_subchapter
    statement.setString(45, data[44]); // cs_subchapter_event
    statement.setString(46, data[45]); // SPV_event
    statement.setString(47, data[46]); // SPN_event
  }

  @Override
  public void clearTable() {
    Connection connection = null;
    Statement statement = null;
    try {
      connection = ConnectionManager.getInstance().getAODATEXConnection();
      statement = connection.createStatement();
      String truncateSql =
          new StringBuilder().append("TRUNCATE TABLE ").append(TABLE_NAME).toString();
      statement.executeUpdate(truncateSql);
    } catch (SQLException e) {
      e.printStackTrace();
    } finally {
      try {
        if (statement != null) statement.close();
      } catch (SQLException e) {
        e.printStackTrace();
      }
      try {
        if (connection != null) connection.close();
      } catch (SQLException e) {
        e.printStackTrace();
      }
    }
  }
}
