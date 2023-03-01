package gov.doj.entities;

import java.sql.Timestamp;

public class Case {
    protected long cases_id;
    public String staff1;
    public String staff2;
    public String idi_status;
    public Timestamp idi_date;
    public int chapters_id;
    public Case(){
    }

    public Case(long id){
        this.cases_id = id;
    }

    public Case(long id, String staff1, String staff2, String idi_status, Timestamp timeStamp, int chapters_id)
    {
        this.cases_id = id;
        this.staff1 = staff1;
        this.staff2 = staff2;
        this.idi_status = idi_status;
        this.idi_date = timeStamp;
        this.chapters_id = chapters_id;
    }

    public Case(String staff1, String staff2, String idiStatus, Timestamp idiDate, int chaptersId) {
        this.staff1 = staff1;
        this.staff2 = staff2;
        this.idi_status = idiStatus;
        this.idi_date = idiDate;
        this.chapters_id = chapters_id;
    }

    public long getCases_id() {
        return cases_id;
    }

    public String getStaff1() {
        return staff1;
    }

    public void setStaff1(String staff1) {
        this.staff1 = staff1;
    }

    public String getStaff2() {
        return staff2;
    }

    public void setStaff2(String staff2) {
        this.staff2 = staff2;
    }

    public String getIdi_status() {
        return idi_status;
    }

    public void setIdi_status(String idi_status) {
        this.idi_status = idi_status;
    }

    public Timestamp getIdi_date() {
        return idi_date;
    }

    public void setIdi_date(Timestamp idi_date) {
        this.idi_date = idi_date;
    }

    public int getChapters_id() {
        return chapters_id;
    }

    public void setChapters_id(int chapters_id) {
        this.chapters_id = chapters_id;
    }
}
