package gov.doj;

import java.io.BufferedReader;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;

public class CMMHRLoader extends AbstractDataLoader implements IDataLoader{

    private final String tableName = "dbo.CMMHR";

    public CMMHRLoader() {
        setLoaderName("CMMHR");
    }

    @Override
    public void initialize(String csvFilePath) {
        setCsvFilePath(csvFilePath);
    }

    @Override
    public void run() {

        //clear the table
        clearTable();

        //Load up the data
        loadTable();

        //Cleanup
    }


    @Override
    public void loadTable() {
        try (BufferedReader lineReader = new BufferedReader(new FileReader(getCsvFilePath()))) {

            String insertSql = "";
            Connection connection = getConnection();
            PreparedStatement statement = connection.prepareStatement(insertSql);

            int count = 0;
            String lineText = null;

            lineReader.readLine(); // skip the header line
            while ((lineText = lineReader.readLine()) != null ){

                String[] data = lineText.split(",");

                //....

                boolean rowInserted = statement.executeUpdate() > 0;

                count++;
                System.out.println("RowInserted : " + rowInserted + ". Row Number : " + count );
            }

            lineReader.close();

        } catch (FileNotFoundException e) {
            throw new RuntimeException(e);
        } catch (IOException e) {
            throw new RuntimeException(e);
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }

    }

    @Override
    public void clearTable() {

        try (Connection connection = getConnection()) {

            String truncateSql = "TRUNCATE TABLE dbo.CMMHR";
            Statement statement = connection.createStatement();
            statement.executeUpdate(truncateSql);


        } catch (SQLException e) {
            e.printStackTrace();
        }
    }
}
