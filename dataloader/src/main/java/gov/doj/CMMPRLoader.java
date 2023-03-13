package gov.doj;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;

public class CMMPRLoader extends AbstractDataLoader implements IDataLoader {

  protected ConnectionManager connectionManager;

  public CMMPRLoader() {
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
        "SET IDENTITY_INSERT dbo.CMMCD ON;INSERT INTO dbo.CMMCD"
            + " (DELETE_CODE,UST_PROF_CODE,PROF_TYPE,PROF_LAST_NAME,PROF_FIRST_NAME,PROF_MI,PROF_ADDRESS1,PROF_ADDRESS2,PROF_CITY,PROF_STATE,PROF_ZIP,PROF_FAX_NBR,PROF_COMMERCIAL_PHONE_NBR,BOND_AMOUNT,BOND_DATE,BOND_COMPANY_CODE,BOND_TOTAL_AMOUNT,BOND_EXPIRATION_DATE,USER_FREE_SPACE_10,SOC_SEC_NUM,TOTAL_FEES_MTD,TOTAL_NBR_CASES_MTD,TOTAL_FEES_YTD,TOTAL_NBR_CASES_YTD,TOTAL_FEES_LSTYR,TOTAL_NBR_CASES_LSTYR,PROF_STATE_NAME,COURT_ASSIGNED_NBR,STAFF_1,STAFF_2,PROF_STATUS,ACTION_CODE,ACTION_START_DATE,ACTION_END_DATE,USER_FREE_SPACE_31,USER_FREE_SPACE_2,ENTRY_DATE,USER_ID,REGION_CODE,GROUP_DESIGNATOR,RGN_CREATE_DATE,RGN_UPDATE_DATE,CDB_CREATE_DATE,CDB_UPDATE_DATE,BOND_DATE_DT,BOND_EXPIRATION_DATE_DT,ACTION_START_DATE_DT,ACTION_END_DATE_DT,ENTRY_DATE_DT,RGN_CREATE_DATE_DT,RGN_UPDATE_DATE_DT,CDB_CREATE_DATE_DT,CDB_UPDATE_DATE_DT,UPDATE_DATE,REPLICATED_DATE,id,RRN)"
            + " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

    Connection connection = this.connectionManager.getConnection();

    try (BufferedReader lineReader = new BufferedReader(new FileReader(getCsvFilePath()))) {
      PreparedStatement statement = connection.prepareStatement(sql);

      int count = 0;
      String lineText = null;

      lineReader.readLine(); // skip the header line

      while ((lineText = lineReader.readLine()) != null) {
        int index = 0;
        String[] data = lineText.split(",");
        SqlStatementHelper.setString(index, data[index++], statement);    // DELETE_CODE
        SqlStatementHelper.setInt(index, data[index++], statement);       // UST_PROF_CODE
        SqlStatementHelper.setString(index, data[index++], statement);    // PROF_TYPE
        SqlStatementHelper.setString(index, data[index++], statement);    // PROF_LAST_NAME
        SqlStatementHelper.setString(index, data[index++], statement);    // PROF_FIRST_NAME
        SqlStatementHelper.setString(index, data[index++], statement);    // PROF_MI
        SqlStatementHelper.setString(index, data[index++], statement);    // PROF_ADDRESS1
        SqlStatementHelper.setString(index, data[index++], statement);    // PROF_ADDRESS2
        SqlStatementHelper.setString(index, data[index++], statement);    // PROF_CITY
        SqlStatementHelper.setString(index, data[index++], statement);    // PROF_STATE
        SqlStatementHelper.setInt(index, data[index++], statement);       // PROF_ZIP
        SqlStatementHelper.setInt(index, data[index++], statement);       // PROF_FAX_NBR
        SqlStatementHelper.setInt(index, data[index++], statement);       // PROF_COMMERCIAL_PHONE_NBR
        SqlStatementHelper.setInt(index, data[index++], statement);       // BOND_AMOUNT
        SqlStatementHelper.setInt(index, data[index++], statement);       // BOND_DATE
        SqlStatementHelper.setString(index, data[index++], statement);    // BOND_COMPANY_CODE
        SqlStatementHelper.setInt(index, data[index++], statement);       // BOND_TOTAL_AMOUNT
        SqlStatementHelper.setInt(index, data[index++], statement);       // BOND_EXPIRATION_DATE
        SqlStatementHelper.setString(index, data[index++], statement);    // USER_FREE_SPACE_10
        SqlStatementHelper.setInt(index, data[index++], statement);       // SOC_SEC_NUM

        SqlStatementHelper.setInt(index, data[index++], statement);       // TOTAL_FEES_MTD
        SqlStatementHelper.setInt(index, data[index++], statement);       // TOTAL_NBR_CASES_MTD
        SqlStatementHelper.setInt(index, data[index++], statement);       // TOTAL_FEES_YTD
        SqlStatementHelper.setInt(index, data[index++], statement);       // TOTAL_NBR_CASES_YTD
        SqlStatementHelper.setInt(index, data[index++], statement);       // TOTAL_FEES_LSTYR
        SqlStatementHelper.setInt(index, data[index++], statement);       // TOTAL_NBR_CASES_LSTYR

        SqlStatementHelper.setString(index, data[index++], statement);    // PROF_STATE_NAME
        SqlStatementHelper.setString(index, data[index++], statement);    // COURT_ASSIGNED_NBR
        SqlStatementHelper.setInt(index, data[index++], statement);       // STAFF_1
        SqlStatementHelper.setInt(index, data[index++], statement);       // STAFF_2
        SqlStatementHelper.setString(index, data[index++], statement);    // PROF_STATUS
        SqlStatementHelper.setString(index, data[index++], statement);    // ACTION_CODE
        SqlStatementHelper.setInt(index, data[index++], statement);       // ACTION_START_DATE
        SqlStatementHelper.setInt(index, data[index++], statement);       // ACTION_END_DATE
        SqlStatementHelper.setString(index, data[index++], statement);    // USER_FREE_SPACE_31
        SqlStatementHelper.setString(index, data[index++], statement);    // USER_FREE_SPACE_2
        SqlStatementHelper.setInt(index, data[index++], statement);       // ENTRY_DATE
        SqlStatementHelper.setString(index, data[index++], statement);    // USER_ID
        SqlStatementHelper.setInt(index, data[index++], statement);       // REGION_CODE
        SqlStatementHelper.setString(index, data[index++], statement);    // GROUP_DESIGNATOR

        SqlStatementHelper.setInt(index, data[index++], statement);       // RGN_CREATE_DATE
        SqlStatementHelper.setInt(index, data[index++], statement);       // RGN_UPDATE_DATE
        SqlStatementHelper.setInt(index, data[index++], statement);       // CDB_CREATE_DATE
        SqlStatementHelper.setInt(index, data[index++], statement);       // CDB_UPDATE_DATE

        SqlStatementHelper.setTimestamp(index, data[index++], statement); // BOND_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // BOND_EXPIRATION_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // ACTION_START_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // ACTION_END_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // ENTRY_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // RGN_CREATE_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // RGN_UPDATE_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // CDB_CREATE_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // CDB_UPDATE_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // UPDATE_DATE
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // REPLICATED_DATE 
        SqlStatementHelper.setInt(index, data[index++], statement);       // id
        SqlStatementHelper.setInt(index, data[index++], statement);       // RRN

        boolean rowInserted = statement.executeUpdate() > 0;

        count++;
        System.out.println("RowInserted : " + rowInserted + ". Row Number : " + count);
      }
    } catch (IOException | SQLException e) {
      throw new RuntimeException(e);
    }
  }

  @Override
  public void clearTable() {
    try (Connection connection = getConnection()) {

      String truncateSql = "TRUNCATE TABLE dbo.CMMCD";
      Statement statement = connection.createStatement();
      statement.executeUpdate(truncateSql);

    } catch (SQLException e) {
      e.printStackTrace();
    }
  }
}
