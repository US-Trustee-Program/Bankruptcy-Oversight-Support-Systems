package gov.doj.adapters.gateways;

import gov.doj.entities.Case;
import gov.doj.usecases.PersistenceGateway;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class LocalPersistenceGateway implements PersistenceGateway {
    List<String> caseList = new ArrayList<>();

    public LocalPersistenceGateway() {
        caseList.add("Case Number: 477-14-12211, Chapter: 11, Debtor: Debby Debtor, Staff1: Brian BusinessAnalyst");
        caseList.add("Case Number: 477-14-12151, Chapter: 11, Debtor: Testy McTesterson, Staff1: Brian BusinessAnalyst");
    }

    @Override
    public List<String> getCases() {
        return caseList;
    }

    @Override
    public List<String> getCase(long caseId) {
        return null;
    }

    @Override
    public long createCase(Case aCaseObj) {
        return 0;
    }

    @Override
    public void updateCase(Case aCaseObj) {

    }

    @Override
    public void deleteCase(long casesId) {

    }
}
