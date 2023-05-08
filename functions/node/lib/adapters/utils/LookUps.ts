export class ReviewCodeDescription{

    mapper = new Map<string, string>();

    constructor(){
        this.initializeMapper();
    }

    initializeMapper(): void{
        this.mapper.set("CL", "CANCELLED");
        this.mapper.set("CT", "CONTINUED");
        this.mapper.set("HD", "HELD");
        this.mapper.set("NS", "NO SHOW");
        this.mapper.set("RS", "RESCHEDULED");
    }

    getDescription(reviewCode: string){
        if (this.mapper.has(reviewCode)) {
            return this.mapper.get(reviewCode);
        } else return " ";
    }

}