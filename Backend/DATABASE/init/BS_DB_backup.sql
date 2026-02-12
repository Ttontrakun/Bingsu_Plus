--
-- PostgreSQL database dump
--

-- Dumped from database version 17.2
-- Dumped by pg_dump version 17.2

-- Started on 2026-02-12 10:10:20 +07

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 5 (class 2615 OID 45596)
-- Name: public; Type: SCHEMA; Schema: -; Owner: Bingsu_Db_Admin
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO "Bingsu_Db_Admin";

--
-- TOC entry 3684 (class 0 OID 0)
-- Dependencies: 5
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: Bingsu_Db_Admin
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 221 (class 1259 OID 45629)
-- Name: Chat; Type: TABLE; Schema: public; Owner: Bingsu_Db_Admin
--

CREATE TABLE public."Chat" (
    id integer NOT NULL,
    name text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "lastUsed" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Chat" OWNER TO "Bingsu_Db_Admin";

--
-- TOC entry 224 (class 1259 OID 45648)
-- Name: ChatMessage; Type: TABLE; Schema: public; Owner: Bingsu_Db_Admin
--

CREATE TABLE public."ChatMessage" (
    id integer NOT NULL,
    "chatId" integer NOT NULL,
    "userId" integer NOT NULL,
    message text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isAiGenerated" boolean DEFAULT false NOT NULL
);


ALTER TABLE public."ChatMessage" OWNER TO "Bingsu_Db_Admin";

--
-- TOC entry 223 (class 1259 OID 45647)
-- Name: ChatMessage_id_seq; Type: SEQUENCE; Schema: public; Owner: Bingsu_Db_Admin
--

CREATE SEQUENCE public."ChatMessage_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."ChatMessage_id_seq" OWNER TO "Bingsu_Db_Admin";

--
-- TOC entry 3686 (class 0 OID 0)
-- Dependencies: 223
-- Name: ChatMessage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: Bingsu_Db_Admin
--

ALTER SEQUENCE public."ChatMessage_id_seq" OWNED BY public."ChatMessage".id;


--
-- TOC entry 222 (class 1259 OID 45638)
-- Name: ChatUser; Type: TABLE; Schema: public; Owner: Bingsu_Db_Admin
--

CREATE TABLE public."ChatUser" (
    "chatId" integer NOT NULL,
    "userId" integer NOT NULL,
    "joinedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    role text DEFAULT 'member'::text NOT NULL
);


ALTER TABLE public."ChatUser" OWNER TO "Bingsu_Db_Admin";

--
-- TOC entry 220 (class 1259 OID 45628)
-- Name: Chat_id_seq; Type: SEQUENCE; Schema: public; Owner: Bingsu_Db_Admin
--

CREATE SEQUENCE public."Chat_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Chat_id_seq" OWNER TO "Bingsu_Db_Admin";

--
-- TOC entry 3687 (class 0 OID 0)
-- Dependencies: 220
-- Name: Chat_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: Bingsu_Db_Admin
--

ALTER SEQUENCE public."Chat_id_seq" OWNED BY public."Chat".id;


--
-- TOC entry 226 (class 1259 OID 45849)
-- Name: Credential; Type: TABLE; Schema: public; Owner: Bingsu_Db_Admin
--

CREATE TABLE public."Credential" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Credential" OWNER TO "Bingsu_Db_Admin";

--
-- TOC entry 225 (class 1259 OID 45848)
-- Name: Credential_id_seq; Type: SEQUENCE; Schema: public; Owner: Bingsu_Db_Admin
--

CREATE SEQUENCE public."Credential_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Credential_id_seq" OWNER TO "Bingsu_Db_Admin";

--
-- TOC entry 3688 (class 0 OID 0)
-- Dependencies: 225
-- Name: Credential_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: Bingsu_Db_Admin
--

ALTER SEQUENCE public."Credential_id_seq" OWNED BY public."Credential".id;


--
-- TOC entry 219 (class 1259 OID 45607)
-- Name: User; Type: TABLE; Schema: public; Owner: Bingsu_Db_Admin
--

CREATE TABLE public."User" (
    id integer NOT NULL,
    email text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "firstName" text,
    "lastName" text,
    "emailVerified" boolean DEFAULT false NOT NULL,
    "verificationToken" text,
    "passwordResetToken" text,
    "isApproved" boolean DEFAULT false NOT NULL,
    role text DEFAULT 'user'::text NOT NULL
);


ALTER TABLE public."User" OWNER TO "Bingsu_Db_Admin";

--
-- TOC entry 218 (class 1259 OID 45606)
-- Name: User_id_seq; Type: SEQUENCE; Schema: public; Owner: Bingsu_Db_Admin
--

CREATE SEQUENCE public."User_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."User_id_seq" OWNER TO "Bingsu_Db_Admin";

--
-- TOC entry 3689 (class 0 OID 0)
-- Dependencies: 218
-- Name: User_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: Bingsu_Db_Admin
--

ALTER SEQUENCE public."User_id_seq" OWNED BY public."User".id;


--
-- TOC entry 217 (class 1259 OID 45597)
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: Bingsu_Db_Admin
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO "Bingsu_Db_Admin";

--
-- TOC entry 3480 (class 2604 OID 45632)
-- Name: Chat id; Type: DEFAULT; Schema: public; Owner: Bingsu_Db_Admin
--

ALTER TABLE ONLY public."Chat" ALTER COLUMN id SET DEFAULT nextval('public."Chat_id_seq"'::regclass);


--
-- TOC entry 3485 (class 2604 OID 45651)
-- Name: ChatMessage id; Type: DEFAULT; Schema: public; Owner: Bingsu_Db_Admin
--

ALTER TABLE ONLY public."ChatMessage" ALTER COLUMN id SET DEFAULT nextval('public."ChatMessage_id_seq"'::regclass);


--
-- TOC entry 3488 (class 2604 OID 45852)
-- Name: Credential id; Type: DEFAULT; Schema: public; Owner: Bingsu_Db_Admin
--

ALTER TABLE ONLY public."Credential" ALTER COLUMN id SET DEFAULT nextval('public."Credential_id_seq"'::regclass);


--
-- TOC entry 3475 (class 2604 OID 45610)
-- Name: User id; Type: DEFAULT; Schema: public; Owner: Bingsu_Db_Admin
--

ALTER TABLE ONLY public."User" ALTER COLUMN id SET DEFAULT nextval('public."User_id_seq"'::regclass);


--
-- TOC entry 3673 (class 0 OID 45629)
-- Dependencies: 221
-- Data for Name: Chat; Type: TABLE DATA; Schema: public; Owner: Bingsu_Db_Admin
--
-- Data removed - empty database


--
-- TOC entry 3676 (class 0 OID 45648)
-- Dependencies: 224
-- Data for Name: ChatMessage; Type: TABLE DATA; Schema: public; Owner: Bingsu_Db_Admin
--
-- Data removed - empty database


--
-- TOC entry 3674 (class 0 OID 45638)
-- Dependencies: 222
-- Data for Name: ChatUser; Type: TABLE DATA; Schema: public; Owner: Bingsu_Db_Admin
--
-- Data removed - empty database


--
-- TOC entry 3678 (class 0 OID 45849)
-- Dependencies: 226
-- Data for Name: Credential; Type: TABLE DATA; Schema: public; Owner: Bingsu_Db_Admin
--
-- Data removed - empty database


--
-- TOC entry 3671 (class 0 OID 45607)
-- Dependencies: 219
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: Bingsu_Db_Admin
--
-- Data removed - empty database


--
-- TOC entry 3669 (class 0 OID 45597)
-- Dependencies: 217
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: Bingsu_Db_Admin
--
-- Data removed - empty database


--
-- TOC entry 3690 (class 0 OID 0)
-- Dependencies: 223
-- Name: ChatMessage_id_seq; Type: SEQUENCE SET; Schema: public; Owner: Bingsu_Db_Admin
--
-- Sequence values reset - empty database


--
-- TOC entry 3691 (class 0 OID 0)
-- Dependencies: 220
-- Name: Chat_id_seq; Type: SEQUENCE SET; Schema: public; Owner: Bingsu_Db_Admin
--
-- Sequence values reset - empty database


--
-- TOC entry 3692 (class 0 OID 0)
-- Dependencies: 225
-- Name: Credential_id_seq; Type: SEQUENCE SET; Schema: public; Owner: Bingsu_Db_Admin
--
-- Sequence values reset - empty database


--
-- TOC entry 3693 (class 0 OID 0)
-- Dependencies: 218
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: Bingsu_Db_Admin
--
-- Sequence values reset - empty database


--
-- TOC entry 3511 (class 2606 OID 45656)
-- Name: ChatMessage ChatMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: Bingsu_Db_Admin
--

ALTER TABLE ONLY public."ChatMessage"
    ADD CONSTRAINT "ChatMessage_pkey" PRIMARY KEY (id);


--
-- TOC entry 3505 (class 2606 OID 45646)
-- Name: ChatUser ChatUser_pkey; Type: CONSTRAINT; Schema: public; Owner: Bingsu_Db_Admin
--

ALTER TABLE ONLY public."ChatUser"
    ADD CONSTRAINT "ChatUser_pkey" PRIMARY KEY ("chatId", "userId");


--
-- TOC entry 3502 (class 2606 OID 45637)
-- Name: Chat Chat_pkey; Type: CONSTRAINT; Schema: public; Owner: Bingsu_Db_Admin
--

ALTER TABLE ONLY public."Chat"
    ADD CONSTRAINT "Chat_pkey" PRIMARY KEY (id);


--
-- TOC entry 3514 (class 2606 OID 45857)
-- Name: Credential Credential_pkey; Type: CONSTRAINT; Schema: public; Owner: Bingsu_Db_Admin
--

ALTER TABLE ONLY public."Credential"
    ADD CONSTRAINT "Credential_pkey" PRIMARY KEY (id);


--
-- TOC entry 3497 (class 2606 OID 45615)
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: Bingsu_Db_Admin
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- TOC entry 3491 (class 2606 OID 45605)
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: Bingsu_Db_Admin
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- TOC entry 3507 (class 1259 OID 45685)
-- Name: ChatMessage_chatId_createdAt_idx; Type: INDEX; Schema: public; Owner: Bingsu_Db_Admin
--

CREATE INDEX "ChatMessage_chatId_createdAt_idx" ON public."ChatMessage" USING btree ("chatId", "createdAt");


--
-- TOC entry 3508 (class 1259 OID 45659)
-- Name: ChatMessage_chatId_idx; Type: INDEX; Schema: public; Owner: Bingsu_Db_Admin
--

CREATE INDEX "ChatMessage_chatId_idx" ON public."ChatMessage" USING btree ("chatId");


--
-- TOC entry 3509 (class 1259 OID 45684)
-- Name: ChatMessage_createdAt_idx; Type: INDEX; Schema: public; Owner: Bingsu_Db_Admin
--

CREATE INDEX "ChatMessage_createdAt_idx" ON public."ChatMessage" USING btree ("createdAt");


--
-- TOC entry 3512 (class 1259 OID 45660)
-- Name: ChatMessage_userId_idx; Type: INDEX; Schema: public; Owner: Bingsu_Db_Admin
--

CREATE INDEX "ChatMessage_userId_idx" ON public."ChatMessage" USING btree ("userId");


--
-- TOC entry 3503 (class 1259 OID 45657)
-- Name: ChatUser_chatId_idx; Type: INDEX; Schema: public; Owner: Bingsu_Db_Admin
--

CREATE INDEX "ChatUser_chatId_idx" ON public."ChatUser" USING btree ("chatId");


--
-- TOC entry 3506 (class 1259 OID 45658)
-- Name: ChatUser_userId_idx; Type: INDEX; Schema: public; Owner: Bingsu_Db_Admin
--

CREATE INDEX "ChatUser_userId_idx" ON public."ChatUser" USING btree ("userId");


--
-- TOC entry 3500 (class 1259 OID 45683)
-- Name: Chat_lastUsed_idx; Type: INDEX; Schema: public; Owner: Bingsu_Db_Admin
--

CREATE INDEX "Chat_lastUsed_idx" ON public."Chat" USING btree ("lastUsed");


--
-- TOC entry 3515 (class 1259 OID 45860)
-- Name: Credential_userId_idx; Type: INDEX; Schema: public; Owner: Bingsu_Db_Admin
--

CREATE INDEX "Credential_userId_idx" ON public."Credential" USING btree ("userId");


--
-- TOC entry 3516 (class 1259 OID 45858)
-- Name: Credential_userId_key; Type: INDEX; Schema: public; Owner: Bingsu_Db_Admin
--

CREATE UNIQUE INDEX "Credential_userId_key" ON public."Credential" USING btree ("userId");


--
-- TOC entry 3517 (class 1259 OID 45861)
-- Name: Credential_username_idx; Type: INDEX; Schema: public; Owner: Bingsu_Db_Admin
--

CREATE INDEX "Credential_username_idx" ON public."Credential" USING btree (username);


--
-- TOC entry 3518 (class 1259 OID 45859)
-- Name: Credential_username_key; Type: INDEX; Schema: public; Owner: Bingsu_Db_Admin
--

CREATE UNIQUE INDEX "Credential_username_key" ON public."Credential" USING btree (username);


--
-- TOC entry 3492 (class 1259 OID 47470)
-- Name: User_email_idx; Type: INDEX; Schema: public; Owner: Bingsu_Db_Admin
--

CREATE INDEX "User_email_idx" ON public."User" USING btree (email);


--
-- TOC entry 3493 (class 1259 OID 45616)
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: Bingsu_Db_Admin
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- TOC entry 3494 (class 1259 OID 47504)
-- Name: User_passwordResetToken_idx; Type: INDEX; Schema: public; Owner: Bingsu_Db_Admin
--

CREATE INDEX "User_passwordResetToken_idx" ON public."User" USING btree ("passwordResetToken");


--
-- TOC entry 3495 (class 1259 OID 47503)
-- Name: User_passwordResetToken_key; Type: INDEX; Schema: public; Owner: Bingsu_Db_Admin
--

CREATE UNIQUE INDEX "User_passwordResetToken_key" ON public."User" USING btree ("passwordResetToken");


--
-- TOC entry 3498 (class 1259 OID 47471)
-- Name: User_verificationToken_idx; Type: INDEX; Schema: public; Owner: Bingsu_Db_Admin
--

CREATE INDEX "User_verificationToken_idx" ON public."User" USING btree ("verificationToken");


--
-- TOC entry 3499 (class 1259 OID 47469)
-- Name: User_verificationToken_key; Type: INDEX; Schema: public; Owner: Bingsu_Db_Admin
--

CREATE UNIQUE INDEX "User_verificationToken_key" ON public."User" USING btree ("verificationToken");


--
-- TOC entry 3521 (class 2606 OID 45671)
-- Name: ChatMessage ChatMessage_chatId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Bingsu_Db_Admin
--

ALTER TABLE ONLY public."ChatMessage"
    ADD CONSTRAINT "ChatMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES public."Chat"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3522 (class 2606 OID 47497)
-- Name: ChatMessage ChatMessage_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Bingsu_Db_Admin
--

ALTER TABLE ONLY public."ChatMessage"
    ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3519 (class 2606 OID 45661)
-- Name: ChatUser ChatUser_chatId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Bingsu_Db_Admin
--

ALTER TABLE ONLY public."ChatUser"
    ADD CONSTRAINT "ChatUser_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES public."Chat"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3520 (class 2606 OID 47492)
-- Name: ChatUser ChatUser_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Bingsu_Db_Admin
--

ALTER TABLE ONLY public."ChatUser"
    ADD CONSTRAINT "ChatUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3523 (class 2606 OID 47487)
-- Name: Credential Credential_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Bingsu_Db_Admin
--

ALTER TABLE ONLY public."Credential"
    ADD CONSTRAINT "Credential_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3685 (class 0 OID 0)
-- Dependencies: 5
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: Bingsu_Db_Admin
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


-- Completed on 2026-02-12 10:10:20 +07

--
-- PostgreSQL database dump complete
--

