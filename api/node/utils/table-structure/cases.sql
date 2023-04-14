SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON

DROP TABLE [dbo].[Cases];
CREATE TABLE [dbo].[Cases](
	[cases_id] [bigint] IDENTITY(1,1) NOT NULL,
	[staff1] [varchar](32) DEFAULT NULL,
	[staff2] [varchar](32) DEFAULT NULL,
	[idi_status] [varchar](16) DEFAULT NULL,
	[idi_date] [datetime] DEFAULT NULL,
	[chapters_id] [int] NOT NULL,

  CONSTRAINT chapters_id
    FOREIGN KEY (chapters_id)
    REFERENCES Chapters (chapters_id)
) ON [PRIMARY]
ALTER TABLE [dbo].[Cases] ADD  CONSTRAINT [PK_Cases] PRIMARY KEY CLUSTERED
(
	[cases_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO


INSERT INTO Cases (staff1, staff2, idi_status, idi_date, chapters_id)
VALUES
  ('Adam', 'Chava', 'Pending', '2023-03-15', 3),
  ('Micah', 'David', 'Completed', '2023-01-23', 3),
  ('Sarah', 'Matt', 'Pending', '2023-03-15', 3);
GO
