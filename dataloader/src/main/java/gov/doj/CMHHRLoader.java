package gov.doj;

import java.io.BufferedReader;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.sql.*;
import java.util.*;

public class CMHHRLoader extends AbstractDataLoader implements IDataLoader{

    protected ConnectionManager connectionManager;

    private final String tableName = "dbo.CMHHR";

    public CMHHRLoader(){
        setLoaderName("CMHHR");
        connectionManager = ConnectionManager.getInstance();
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

        try (BufferedReader lineReader = new BufferedReader(new FileReader(getCsvFilePath()))) {

            String insertSql =
                    "SET IDENTITY_INSERT dbo.CMHHR ON;INSERT INTO dbo.CMHHR"
                            + "([DELETE_CODE],[CASE_DIV],[CASE_YEAR],[CASE_NUMBER],[RECORD_SEQ_NBR]"
                            + ",[HEARING_CODE],[HEARING_DATE],[HEARING_TIME],[HEARING_LOCATION],[HEARING_PLACE],[HEARING_DISP]"
                            + ",[DISPOSITION_DATE],[CURRENT_CASE_CHAPTER],[PRINT_CALENDAR]"
                            + ",[DESCRIPTION_30],[ENTRY_DATE],[USER_ID],[REGION_CODE],[GROUP_DESIGNATOR]"
                            + ",[RGN_CREATE_DATE],[RGN_UPDATE_DATE],[CDB_CREATE_DATE],[CDB_UPDATE_DATE],[HEARING_DATE_DT],[DISPOSITION_DATE_DT]"
                            + ",[ENTRY_DATE_DT],[RGN_CREATE_DATE_DT],[RGN_UPDATE_DATE_DT],[CDB_CREATE_DATE_DT],[CDB_UPDATE_DATE_DT]"
                            + ",[CASE_FULL_ACMS],[UPDATE_DATE],[REPLICATED_DATE],[id],[RRN])"
                            + " VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,"
                            + " ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

            Connection connection = this.connectionManager.getConnection();
            PreparedStatement statement = connection.prepareStatement(insertSql);

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
        }

    }

    private void setValuesToInsert(PreparedStatement statement, String[] data)
            throws SQLException {
        statement.setString(1, data[0]); // [DELETE_CODE]
        statement.setInt(2, Integer.parseInt(data[1])); // CASE_DIV
        statement.setInt(3, Integer.parseInt(data[2])); // CASE_YEAR
        statement.setInt(4, Integer.parseInt(data[3])); // CASE_NUMBER
        statement.setInt(5, Integer.parseInt(data[4])); // RECORD_SEQ_NBR
        statement.setString(6, data[5]); //HEARING_CODE
        statement.setInt(7, Integer.parseInt(data[6])); //HEARING_DATE
        statement.setInt(8, Integer.parseInt(data[7])); //HEARING_TIME
        statement.setString(9, data[8]); //HEARING_LOCATION
        statement.setString(10, data[9]); //HEARING_PLACE
        statement.setString(11, data[10]); //HEARING_DISP
        statement.setInt(12, Integer.parseInt(data[11])); //DISPOSITION_DATE
        statement.setString(13, data[12]); //CURRENT_CASE_CHAPTER
        statement.setString(14, data[13]); //PRINT_CALENDAR
        statement.setString(15, data[14].substring(0, 29)); //DESCRIPTION_30
        statement.setInt(16, Integer.parseInt(data[15])); //ENTRY_DATE
        statement.setString(17, data[16].substring(0,9)); //USER_ID
        statement.setString(18, data[17]); //REGION_CODE
        statement.setString(19, data[18]); //GROUP_DESIGNATOR
        statement.setInt(20, Integer.parseInt(data[19])); //RGN_CREATE_DATE
        statement.setInt(21, Integer.parseInt(data[20])); //RGN_UPDATE_DATE
        statement.setInt(22, Integer.parseInt(data[21])); //CDB_CREATE_DATE
        statement.setInt(23, Integer.parseInt(data[22])); //CDB_UPDATE_DATE
        setTimeStamp(23, data[23], statement); //HEARING_DATE_DT
        setTimeStamp(24, data[24], statement); //DISPOSITION_DATE_DT
        setTimeStamp(25, data[25], statement); //ENTRY_DATE_DT
        setTimeStamp(26, data[26], statement); //RGN_CREATE_DATE_DT
        setTimeStamp(27, data[27], statement); //RGN_UPDATE_DATE_DT
        setTimeStamp(28, data[28], statement); //CDB_CREATE_DATE_DT
        setTimeStamp(29, data[29], statement); //CDB_UPDATE_DATE_DT
        statement.setString(31, data[30]); //CASE_FULL_ACMS

        setTimeStamp(31, data[31], statement); //UPDATE_DATE
        setTimeStamp(32, data[32], statement); //REPLICATED_DATE
        statement.setInt(34, Integer.parseInt(data[33])); // id
        statement.setInt(35, Integer.parseInt(data[34])); // RRN
    }

    private void setTimeStamp(int dataIndex, String data, PreparedStatement statement) {
        try{
            if (data == null || data.isEmpty() || data.contains("NULL")) {

                statement.setNull(dataIndex+1, Types.TIMESTAMP);
            } else {
                //statement.setTimestamp(dataIndex+1, Timestamp.valueOf(data));
                statement.setNull(dataIndex+1, Types.TIMESTAMP); // Nullify timestamp columns - story#111
            }
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }
    @Override
    public void clearTable() {
        Connection connection = this.connectionManager.getConnection();
        try {

            String truncateSql = "TRUNCATE TABLE dbo.CMHHR";
            Statement statement = connection.createStatement();
            statement.executeUpdate(truncateSql);

        } catch (SQLException e) {
            e.printStackTrace();
        }

    }
}
