package gov.doj.adapters.gateways;

import gov.doj.usecases.PersistenceGateway;

import java.util.ArrayList;
import java.util.List;

public class LocalPersistenceGateway implements PersistenceGateway {
    List<String> caseList = new ArrayList<>();

    @Override
    public void addCase(String caseData) {
        caseList.add(caseData);
    }
}
