"""Создать начальную схему PostgreSQL для MVP."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20261119_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "universities",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id", name="pk_universities"),
        sa.UniqueConstraint("name", name="uq_universities_name"),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("university_id", sa.Uuid(), nullable=False),
        sa.Column("faculty", sa.String(length=255), nullable=True),
        sa.Column("course", sa.SmallInteger(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint(
            "course IS NULL OR course BETWEEN 1 AND 6",
            name="ck_users_course_range",
        ),
        sa.ForeignKeyConstraint(
            ["university_id"],
            ["universities.id"],
            name="fk_users_university_id_universities",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_university_id", "users", ["university_id"])

    op.create_table(
        "ad_categories",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id", name="pk_ad_categories"),
        sa.UniqueConstraint("name", name="uq_ad_categories_name"),
    )

    op.create_table(
        "ads",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=False),
        sa.Column("university_id", sa.Uuid(), nullable=False),
        sa.Column("category_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("price_rub", sa.Integer(), nullable=True),
        sa.Column("image_url", sa.String(length=2048), nullable=True),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'active'"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint("char_length(title) >= 3", name="ck_ads_title_min_length"),
        sa.CheckConstraint("char_length(description) >= 1", name="ck_ads_description_not_empty"),
        sa.CheckConstraint(
            "price_rub IS NULL OR price_rub >= 0",
            name="ck_ads_price_rub_nonnegative",
        ),
        sa.CheckConstraint(
            "status IN ('active', 'closed')",
            name="ck_ads_status",
        ),
        sa.ForeignKeyConstraint(
            ["author_id"],
            ["users.id"],
            name="fk_ads_author_id_users",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["university_id"],
            ["universities.id"],
            name="fk_ads_university_id_universities",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["ad_categories.id"],
            name="fk_ads_category_id_ad_categories",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_ads"),
    )
    op.create_index("ix_ads_author_id", "ads", ["author_id"])
    op.create_index("ix_ads_university_id", "ads", ["university_id"])
    op.create_index("ix_ads_category_id", "ads", ["category_id"])
    op.create_index("ix_ads_status", "ads", ["status"])

    op.create_table(
        "forum_sections",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id", name="pk_forum_sections"),
        sa.UniqueConstraint("name", name="uq_forum_sections_name"),
    )

    op.create_table(
        "forum_topics",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("section_id", sa.Uuid(), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint(
            "char_length(title) >= 1",
            name="ck_forum_topics_title_not_empty",
        ),
        sa.CheckConstraint(
            "char_length(body) >= 1",
            name="ck_forum_topics_body_not_empty",
        ),
        sa.ForeignKeyConstraint(
            ["section_id"],
            ["forum_sections.id"],
            name="fk_forum_topics_section_id_forum_sections",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["author_id"],
            ["users.id"],
            name="fk_forum_topics_author_id_users",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_forum_topics"),
    )
    op.create_index("ix_forum_topics_section_id", "forum_topics", ["section_id"])
    op.create_index("ix_forum_topics_author_id", "forum_topics", ["author_id"])

    op.create_table(
        "forum_replies",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("topic_id", sa.Uuid(), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint(
            "char_length(body) >= 1",
            name="ck_forum_replies_body_not_empty",
        ),
        sa.ForeignKeyConstraint(
            ["topic_id"],
            ["forum_topics.id"],
            name="fk_forum_replies_topic_id_forum_topics",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["author_id"],
            ["users.id"],
            name="fk_forum_replies_author_id_users",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_forum_replies"),
    )
    op.create_index("ix_forum_replies_topic_id", "forum_replies", ["topic_id"])
    op.create_index("ix_forum_replies_author_id", "forum_replies", ["author_id"])


def downgrade() -> None:
    op.drop_index("ix_forum_replies_author_id", table_name="forum_replies")
    op.drop_index("ix_forum_replies_topic_id", table_name="forum_replies")
    op.drop_table("forum_replies")

    op.drop_index("ix_forum_topics_author_id", table_name="forum_topics")
    op.drop_index("ix_forum_topics_section_id", table_name="forum_topics")
    op.drop_table("forum_topics")

    op.drop_table("forum_sections")

    op.drop_index("ix_ads_status", table_name="ads")
    op.drop_index("ix_ads_category_id", table_name="ads")
    op.drop_index("ix_ads_university_id", table_name="ads")
    op.drop_index("ix_ads_author_id", table_name="ads")
    op.drop_table("ads")

    op.drop_table("ad_categories")

    op.drop_index("ix_users_university_id", table_name="users")
    op.drop_table("users")

    op.drop_table("universities")