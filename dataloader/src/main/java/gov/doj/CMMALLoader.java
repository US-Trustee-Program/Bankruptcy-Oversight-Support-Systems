package gov.doj;

import java.io.*;
import java.sql.*;
import java.util.HashMap;
import java.util.Map;
import javax.json.*;

public class CMMALLoader extends AbstractDataLoader implements IDataLoader {

  protected ConnectionManager connectionManager;

  private final Map<String, Integer> federalIdMap = new HashMap<>();
  private int federalId = 20230001;

  public CMMALLoader() {
    setLoaderName("CMMAL");
    connectionManager = ConnectionManager.getInstance();
  }

  @Override
  public void run() {
    clearTable();
    loadTable();
  }

  @Override
  public void initialize(String filePath) {
    setCsvFilePath(filePath);

    try {
      // setup hash of existing federal id numbers
      JsonReader parser = Json.createReader(new FileReader("federalIdHashmap.json"));
      JsonObject hashData = parser.readObject();
      Map<String, JsonValue> federalIdMap = new HashMap<>(hashData); 
      //fedIdMap.forEach((k, v) -> federalIdMap.put(k, v));
    } catch(Exception e) {
      System.out.println(e.getMessage());
    }
  }

  @Override
  public void loadTable() {
    String sql =
        "SET IDENTITY_INSERT dbo.CMMAL ON;INSERT INTO dbo.CMMAL ("
            + " DELETE_CODE,CASE_DIV,CASE_YEAR,CASE_NUMBER,SEQ_NBR,FEDERAL_ID,BLANK_06,SOC_SEC_NUM,DEBTOR_NAME,"
            + " ENTRY_DATE,REGION_CODE,GROUP_DESIGNATOR,RGN_CREATE_DATE,RGN_UPDATE_DATE,CDB_CREATE_DATE,"
            + " CDB_UPDATE_DATE,ENTRY_DATE_DT,RGN_CREATE_DATE_DT,RGN_UPDATE_DATE_DT,CDB_CREATE_DATE_DT,"
            + " CDB_UPDATE_DATE_DT,CASE_FULL_ACMS,UPDATE_DATE,REPLICATED_DATE,id,RRN )  VALUES( ?,"
            + " ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, )";

    Connection connection = this.connectionManager.getConnection();

    // Run the data load
    try (BufferedReader lineReader = new BufferedReader(new FileReader(getCsvFilePath()))) {

      PreparedStatement statement = connection.prepareStatement(sql);

      String lineText = null;
      int count = 0;

      lineReader.readLine(); // skip the header line

      while ((lineText = lineReader.readLine()) != null) {
        int index = 0;
        String[] data = lineText.split(",");

        // System.out.println("data:" + Arrays.toString(data));
        SqlStatementHelper.setCharString(index, data[index++], 1, statement); // DELETE_CODE
        SqlStatementHelper.setInt(index, data[index++], statement); // CASE_DIV
        SqlStatementHelper.setInt(index, data[index++], statement); // CASE_YEAR
        SqlStatementHelper.setInt(index, data[index++], statement); // CASE_NUMBER
        SqlStatementHelper.setInt(index, data[index++], statement); // SEQ_NBR
        SqlStatementHelper.setInt(
            index, numericizeFederalId(data[index++]), statement); // FEDERAL_ID
        SqlStatementHelper.setCharString(index, data[index++], 6, statement); // BLANK_06
        SqlStatementHelper.setInt(
            index, data[index++].replaceAll("[^0-9]", ""), statement); // SOC SEC NUM
        SqlStatementHelper.setCharString(index, data[index++], statement); // DEBTOR_NAME
        SqlStatementHelper.setInt(index, data[index++], statement); // ENTRY_DATE
        SqlStatementHelper.setCharString(index, data[index++], 2, statement); // REGION_CODE
        SqlStatementHelper.setCharString(index, data[index++], 2, statement); // GROUP_DESIGNATOR
        SqlStatementHelper.setInt(index, data[index++], statement); // RGN_CREATE_DATE
        SqlStatementHelper.setInt(index, data[index++], statement); // RGN_UPDATE_DATE
        SqlStatementHelper.setInt(index, data[index++], statement); // CDB_CREATE_DATE
        SqlStatementHelper.setInt(index, data[index++], statement); // CDB_UPDATE_DATE
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // ENTRY_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // RGN_CREATE_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // RGN_UPDATE_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // CDB_CREATE_DATE_DT
        SqlStatementHelper.setTimestamp(index, data[index++], statement); // CDB_UPDATE_DATE_DT
        SqlStatementHelper.setVarCharString(
            index, data[index++], 10, statement); // CASE_FULL_ACMS - varchar
        SqlStatementHelper.setTimestamp(
            index++, "NULL",
            statement); // UPDATE_DATE (using NULL rather than actual string because data in input
        // file is messed up and will cause an exception)
        SqlStatementHelper.setTimestamp(index++, "NULL", statement); // REPLICATED_DATE

        SqlStatementHelper.setInt(index, data[index++], statement); // id
        SqlStatementHelper.setInt(index, data[index++], statement); // RRN

        /*
        boolean rowInserted = statement.executeUpdate() > 0;

        count++;
        System.out.println("RowInserted : " + rowInserted + ". Row Number : " + count);
        */
      }

    } catch (FileNotFoundException e) {
      throw new RuntimeException(e);
    } catch (IOException e) {
      throw new RuntimeException(e);
    } catch (SQLException e) {
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
    Connection connection = this.connectionManager.getConnection();
    try {

      String truncateSql = "TRUNCATE TABLE dbo.CMMAL";
      Statement statement = connection.createStatement();
      statement.executeUpdate(truncateSql);

    } catch (SQLException e) {
      e.printStackTrace();
    }
  }
}
