package gov.doj.adapters.gateways;

import org.eclipse.microprofile.config.ConfigProvider;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Properties;

public class ConnectionManager {

    private final String connectionUrl;
    private final Properties properties;
    private Connection connection;

    public ConnectionManager() {
        this.connectionUrl = ConfigProvider.getConfig().getValue("url", String.class);
        String user = ConfigProvider.getConfig().getValue("sql.user", String.class);
        String password = ConfigProvider.getConfig().getValue("password", String.class);
        properties = new Properties();
        properties.put("user", user);
        properties.put("password", password);
    }

    public Connection getConnection() {

        try {
            connection = DriverManager.getConnection(connectionUrl, properties);
        }catch (SQLException e){
            e.printStackTrace();
        }

        return connection;
    }

    public void closeConnection() {

        try {
            this.connection.close();
        }catch (SQLException e){
            e.printStackTrace();
        }
    }

}
