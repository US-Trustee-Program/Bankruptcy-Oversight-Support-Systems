SET ANSI_NULLS ON
SET QUOTED_IDENTIFIER ON
DROP TABLE Chapters
CREATE TABLE [dbo].[Chapters](
	[chapters_id] [int] IDENTITY(1,1) NOT NULL,
	[title] [varchar](32) NULL
) ON [PRIMARY]
ALTER TABLE [dbo].[Chapters] ADD  CONSTRAINT [PK_Chapters] PRIMARY KEY CLUSTERED
(
	[chapters_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
ALTER TABLE [dbo].[Chapters] ADD  DEFAULT (NULL) FOR [title]
GO

INSERT INTO Chapters (title)
VALUES
  ('Chapter 7'),
  ('Chapter 9'),
  ('Chapter 11'),
  ('Chapter 12'),
  ('Chapter 15'),
  ('Chapter 19');
GO
